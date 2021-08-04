import { OpenAPIV3 as oa } from 'openapi-types'
import * as SwaggerParser from '@apidevtools/swagger-parser'

const httpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export interface ParserOptions {
  schemaNamespace?: string
  transformPath?: (path: string) => string
  ignoreRequiredProp?: boolean | Partial<Record<'parameters' | 'schemas', boolean>>
}

export interface Parsed {
  schemas: ParsedSchema[]
  endpoints: ParsedEndpoint[]
}

export interface ParsedSchema {
  name: string
  typeString: string
}

export interface ParsedParameter {
  name: string
  in: string
  required: boolean
  typeString: string
}

export interface ParsedRequestBody {
  typeString: string
}

export interface ParsedResponse {
  status: number
  typeString: string
}

export interface ParsedEndpoint {
  path: string
  method: string
  operationName: string
  parameters: ParsedParameter[]
  pathParameters: ParsedParameter[]
  queryParameters: ParsedParameter[]
  requestBody: ParsedRequestBody | null
  responses: ParsedResponse[]
}

export interface TypeStringContext {
  namespaced: boolean
  readable: boolean
  writable: boolean
}

function fallbackOperationId(path: string, method: string) {
  const pathPascalCased = path
    .replace(/(?:\/|_)(\w)/g, (_, c) => c.toUpperCase())
    .replace(
      /\/\{(.+?)\}/g,
      (_, term) =>
        term.slice(0, 1).toUpperCase() + term.slice(1).toLowerCase()
    )
  return `${method}${pathPascalCased}`
}

export class Parser {
  protected readonly raw: any
  protected readonly bundled = new SwaggerParser()
  protected readonly options: Readonly<{
    schemaNamespace: string;
    transformPath: (path: string) => string;
    ignoreRequiredProp: {
      parameters: boolean;
      schemas: boolean;
    };
  }>

  constructor(raw: any, options: ParserOptions) {
    this.raw = raw
    this.options = {
      ...options,
      schemaNamespace: options.schemaNamespace ?? '',
      transformPath: options.transformPath ?? ((path: string) => path),
      ignoreRequiredProp: {
        parameters: typeof options.ignoreRequiredProp === 'boolean' ? options.ignoreRequiredProp : options.ignoreRequiredProp?.parameters ?? false,
        schemas: typeof options.ignoreRequiredProp === 'boolean' ? options.ignoreRequiredProp : options.ignoreRequiredProp?.schemas ?? false,
      },
    }
  }

  protected get spec() {
    return this.bundled.api as oa.Document
  }

  protected ref<T>(refString: string): T {
    return this.bundled.$refs.get(refString)
  }

  async parse() {
    await this.bundled.bundle(this.raw)

    const schemas: ParsedSchema[] = Object.entries(this.spec.components?.schemas ?? {})
      .flatMap(([name, schema]) => {
        const schemas: ParsedSchema[] = []

        schemas.push({
          name,
          typeString: this.typeString(schema, { namespaced: false }) ?? 'unknown',
        })

        if (this.hasReadOnly(schema)) {
          schemas.push({
            name: name + 'Writable',
            typeString: this.typeString(schema, { namespaced: false, writable: true }) ?? 'unknown',
          })
        }

        if (this.hasWriteOnly(schema)) {
          schemas.push({
            name: name + 'Readable',
            typeString: this.typeString(schema, { namespaced: false, readable: true }) ?? 'unknown',
          })
        }

        return schemas
      })

    const endpoints: ParsedEndpoint[] = Object.entries(this.spec.paths)
      .flatMap(([path, pathItem]) =>
        pathItem
          ? httpMethods
            .map((method) => ({ method, operation: pathItem[method] }))
            .flatMap(({ method, operation }) => operation ? { path, method, operation, parameters: pathItem.parameters } : [])
          : []
      )
      .map(({ path, method, operation, parameters }) => this.convertEndpoint(path, method, operation, parameters))

    return {
      schemas,
      endpoints,
    }
  }

  protected convertEndpoint(path: string, method: string, operation: oa.OperationObject, operationParameters: (oa.ParameterObject | oa.ReferenceObject)[] = []): ParsedEndpoint {
    path = this.options.transformPath(path)

    const parameters = [...operationParameters, ...(operation.parameters ?? [])]
      .map(
        (p) => ('$ref' in p ? this.ref(p.$ref) : p) as oa.ParameterObject
      )
      .map((p) => this.convertParameter(p))

    return {
      path,
      method,
      operationName: operation.operationId || fallbackOperationId(path, method),
      parameters,
      pathParameters: parameters.filter((p) => p.in === 'path'),
      queryParameters: parameters.filter((p) => p.in === 'query'),
      requestBody: operation.requestBody
        ? this.convertRequestBody(operation.requestBody)
        : null,
      responses: Object.entries(operation.responses!).map(([status, response]: [string, oa.ResponseObject | oa.ReferenceObject]) =>
        this.convertResponse(status, response)
      ),
    }
  }

  protected convertParameter(parameter: oa.ParameterObject): ParsedParameter {
    return {
      name: parameter.name,
      in: parameter.in,
      required: this.options.ignoreRequiredProp.parameters ? true : !!parameter.required,
      typeString: this.typeString(parameter.schema) ?? 'unknown',
    }
  }

  protected convertRequestBody(requestBody: oa.RequestBodyObject | oa.ReferenceObject): ParsedRequestBody {
    if ('$ref' in requestBody) {
      return this.convertRequestBody(this.ref(requestBody.$ref))
    }

    const schema = requestBody.content?.['application/json']?.schema

    return {
      typeString: this.typeString(schema, { writable: true }) ?? 'unknown'
    }
  }

  protected convertResponse(
    status: string,
    response: oa.ResponseObject | oa.ReferenceObject
  ): ParsedResponse {
    if ('$ref' in response) {
      return this.convertResponse(
        status,
        this.ref(response.$ref)
      )
    }

    if (!response.content) {
      return { status: Number(status), typeString: 'null' }
    }

    const schema = response.content?.['application/json']?.schema

    return {
      status: Number(status),
      typeString: this.typeString(schema, { readable: true }) ?? 'unknown'
    }
  }

  protected typeString(
    schema?: oa.SchemaObject | oa.ReferenceObject,
    { namespaced = true, writable = false, readable = false }: Partial<TypeStringContext> = {}
  ): string | null {
    if (!schema) {
      return null
    }

    const typeString: string | null = this.typeStringWithoutNullable(schema, {
      namespaced,
      writable,
      readable,
    })

    if (!typeString) {
      return null
    }

    if (this.isNullable(schema)) {
      return `${typeString} | null`
    }

    return typeString
  }

  protected typeStringWithoutNullable(
    schema: oa.SchemaObject | oa.ReferenceObject,
    context: TypeStringContext
  ): string | null {
    if ('$ref' in schema) {
      let typename = schema.$ref.split('/').pop()!
      if (context.namespaced && this.options.schemaNamespace) {
        typename = `${this.options.schemaNamespace}.${typename}`
      }
      if (context.writable && this.hasReadOnly(schema)) {
        typename += 'Writable'
      } else if (context.readable && this.hasWriteOnly(schema)) {
        typename += 'Readable'
      }
      return typename
    }

    if (schema.allOf) {
      return schema.allOf
        .map((schema) => this.typeString(schema, context))
        .filter((typeString) => !!typeString)
        .join(' & ') || null
    }

    if (schema.oneOf) {
      return schema.oneOf
        .map((schema) => this.typeString(schema, context))
        .filter((typeString) => !!typeString)
        .join(' | ') || null
    }

    if (schema.enum) {
      return schema.enum
        .map((str) => (schema.type === 'string' ? `'${str}'` : str))
        .join(' | ') || null
    }

    switch (schema.type) {
      case 'integer':
        return 'number'

      case 'array':
        return `Array<${this.typeString(schema.items, context) ?? 'unknown'}>`

      case 'object': {
        if (!schema.properties) {
          return 'object'
        }

        let entries = Object.entries(schema.properties)
        if (context.readable) {
          entries = entries.filter(([name, property]) => !('writeOnly' in property && property.writeOnly))
        }
        if (context.writable) {
          entries = entries.filter(([name, property]) => !('readOnly' in property && property.readOnly))
        }
        return (
          '{ ' +
          entries.map(
            ([name, property]) =>
              `${name}${
                this.options.ignoreRequiredProp.schemas || schema.required?.includes(name) ? '' : '?'
              }: ${this.typeString(property, context) ?? 'unknown'}`
          ).join('; ') +
          ' }'
        )
      }

      case 'string':
      case 'number':
      case 'boolean':
        return schema.type
    }

    return null
  }

  protected isNullable(schema: oa.SchemaObject | oa.ReferenceObject): boolean {
    if ('$ref' in schema) {
      return this.ref<oa.SchemaObject | null>(schema.$ref)?.nullable ?? false
    } else {
      return schema.nullable ?? false
    }
  }

  protected hasReadOnly(schema: oa.SchemaObject | oa.ReferenceObject): boolean {
    return this.hasSchemaPropertyRecursive('readOnly', schema)
  }

  protected hasWriteOnly(schema: oa.SchemaObject | oa.ReferenceObject): boolean {
    return this.hasSchemaPropertyRecursive('writeOnly', schema)
  }

  protected hasSchemaPropertyRecursive(property: keyof oa.SchemaObject, schema: oa.SchemaObject | oa.ReferenceObject): boolean {
    if ('$ref' in schema) {
      const ref = this.ref<oa.SchemaObject | null>(schema.$ref)
      if (!ref) return false
      return this.hasSchemaPropertyRecursive(property, ref)
    }

    if (schema.allOf?.some((schema) => this.hasSchemaPropertyRecursive(property, schema))) {
      return true
    }

    if (schema.oneOf?.some((schema) => this.hasSchemaPropertyRecursive(property, schema))) {
      return true
    }

    if (
      schema.type === 'object' &&
      Object.values(schema.properties ?? {}).some((schema) => this.hasSchemaPropertyRecursive(property, schema))
    ) {
      return true
    }

    return property in schema
  }
}
