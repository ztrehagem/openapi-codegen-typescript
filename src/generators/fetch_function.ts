import * as path from 'path'
import { Parser } from '../parser'
import { Renderer } from '../renderer'
import * as getPackageDir from 'pkg-dir'

interface Options {
  document: string
  outDir: string
}

export async function generate(options: Options) {
  const packageDir = (await getPackageDir(__dirname))!

  const parser = new Parser(options.document, {
    schemaNamespace: 'schema',
  })

  const renderer = new Renderer({
    srcDir: path.join(packageDir, 'templates/fetch_function'),
    srcFileGlob: ['**/*.ts.hbs'],
    outDir: options.outDir,
  })

  const parsed = await parser.parse()
  await renderer.render(parsed)
}
