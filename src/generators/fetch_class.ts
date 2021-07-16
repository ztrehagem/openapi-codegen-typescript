import * as path from 'path'
import { Parser, ParserOptions } from '../parser'
import { Renderer } from '../renderer'
import * as getPackageDir from 'pkg-dir'

interface Options {
  document: string
  outDir: string
  parserOptions?: ParserOptions
}

export async function generate(options: Options) {
  const packageDir = (await getPackageDir(__dirname))!

  const parser = new Parser(options.document, {
    schemaNamespace: 'schema',
    ...options.parserOptions ?? {},
  })

  const renderer = new Renderer({
    srcDir: path.join(packageDir, 'templates/fetch_class'),
    srcFileGlob: ['**/*.ts.hbs', '**/*.ts'],
    outDir: options.outDir,
  })

  const parsed = await parser.parse()
  await renderer.render(parsed)
}
