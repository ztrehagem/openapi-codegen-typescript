import { OpenAPIV3 as oa } from 'openapi-types'
import * as SwaggerParser from '@apidevtools/swagger-parser'

const httpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export interface ParserOptions {
  schemaNamespace?: string
  transformPath?: (path: string) => string
}

export type Parsed = ReturnType<Parser['parse']> extends Promise<infer U> ? U : never

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
  protected readonly swaggerParser = new SwaggerParser()
  protected readonly options: Required<ParserOptions>

  constructor(raw: any, options: ParserOptions) {
    this.raw = raw
    this.options = {
      ...options,
      schemaNamespace: options.schemaNamespace ?? '',
      transformPath: options.transformPath ?? ((path: string) => path),
    }
  }

  protected get spec() {
    return this.swaggerParser.api as oa.Document
  }

  protected ref<T>(refString: string): T {
    return this.swaggerParser.$refs.get(refString)
  }

  async parse() {
    await this.swaggerParser.bundle(this.raw)

    const schemas = Object.entries(this.spec.components?.schemas ?? {})
      .map(([name, schema]) => ({
        name,
        typeString: this.typeString(schema, { namespaced: false }),
      }))

    const endpoints = Object.entries(this.spec.paths)
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

  protected convertEndpoint(path: string, method: string, operation: oa.OperationObject, operationParameters: (oa.ParameterObject | oa.ReferenceObject)[] = []) {
    path = this.options.transformPath(path)

    const parameters = [...operationParameters, ...(operation.parameters ?? [])]
      .map(
        (p) => ('$ref' in p ? this.ref(p.$ref) : p) as oa.ParameterObject
      )
      .map((p) => this.convertParameter(p))

    return {
      path,

      method,

      operationName:
        operation.operationId || fallbackOperationId(path, method),

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

  protected convertParameter(parameter: oa.ParameterObject) {
    return {
      name: parameter.name,
      in: parameter.in,
      required: !!parameter.required,
      typeString: this.typeString(parameter.schema!),
    }
  }

  protected convertRequestBody(requestBody: oa.RequestBodyObject | oa.ReferenceObject): { typeString: string } {
    if ('$ref' in requestBody) {
      return this.convertRequestBody(this.ref(requestBody.$ref))
    }

    const schema = requestBody.content?.['application/json']?.schema
    return { typeString: this.typeString(schema) }
  }

  protected convertResponse(
    status: string,
    response: oa.ResponseObject | oa.ReferenceObject
  ): { status: number; typeString: string } {
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

    return { status: Number(status), typeString: this.typeString(schema!) }
  }

  protected typeString(
    schema?: oa.SchemaObject | oa.ReferenceObject,
    { namespaced = true }: { namespaced?: boolean } = {}
  ): string {
    if (!schema) {
      return 'unknown'
    }

    if ('$ref' in schema) {
      const typename = schema.$ref.split('/').pop()!
      return this.options.schemaNamespace
        ? `${this.options.schemaNamespace}.${typename}`
        : typename
    }

    if (schema.allOf) {
      return schema.allOf
        .map((schema) => this.typeString(schema))
        .filter((typeString) => !!typeString)
        .join(' & ')
    }

    if (schema.oneOf) {
      return schema.oneOf
        .map((schema) => this.typeString(schema))
        .filter((typeString) => !!typeString)
        .join(' | ')
    }

    if (schema.enum) {
      return schema.enum
        .map((str) => (schema.type === 'string' ? `'${str}'` : str))
        .join(' | ')
    }

    switch (schema.type) {
      case 'integer':
        return 'number'
      case 'array':
        return `Array<${this.typeString(schema.items!, { namespaced })}>`
      case 'object':
        if (!schema.properties) {
          return 'object'
        }
        return (
          '{ ' +
          Object.entries(schema.properties)
            .map(
              ([name, property]) =>
                `${name}${
                  schema.required?.includes(name) ? '' : '?'
                }: ${this.typeString(property, { namespaced })}`
            )
            .join('; ') +
          ' }'
        )
      default:
        return schema.type!
    }
  }
}
