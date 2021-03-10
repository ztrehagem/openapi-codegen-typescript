import * as path from 'path'
import { Parser } from '../parser'
import { Renderer } from '../renderer'

interface Options {
  document: string
  outDir: string
}

export async function generate(options: Options) {
  const parser = new Parser(options.document, {
    schemaNamespace: 'schema',
  })

  const renderer = new Renderer({
    srcDir: path.join(__dirname, '../../templates/fetch_function'),
    srcFileGlob: ['**/*.ts.hbs'],
    outDir: options.outDir,
  })

  const parsed = await parser.parse()
  await renderer.render(parsed)
}
