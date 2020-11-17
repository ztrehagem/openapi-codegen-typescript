import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as handlebars from 'handlebars'
import * as globby from 'globby'
import type { Parsed } from './parser'

const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

type Handlebars = typeof handlebars

export interface RendererOptions {
  srcDir: string
  outDir: string
  srcFileGlob?: string
  renameFile?: (filePath: string) => string
  configHandlebars?: (handlebars: Handlebars) => void
}

function noop<T>(arg: T) {
  return arg
}

export class Renderer {
  protected readonly options: Required<RendererOptions>

  constructor(options: RendererOptions) {
    this.options = {
      ...options,
      srcFileGlob: options.srcFileGlob ?? '**/*.hbs',
      renameFile: options.renameFile ?? ((filePath: string) => filePath.replace(/\.hbs$/, '')),
      configHandlebars: options.configHandlebars ?? noop,
    }
  }

  async render(parsed: Parsed) {
    const hbsPaths = await globby(this.options.srcFileGlob, { cwd: this.options.srcDir })
    const compiler = handlebars.create()
    this.options.configHandlebars(compiler)

    await Promise.all(
      hbsPaths.map(async (hbsPath) => {
        const srcFilePath = path.join(this.options.srcDir, hbsPath)
        const hbs = (await readFileAsync(srcFilePath)).toString()
        const rendered = compiler.compile(hbs)(parsed)
        const outFilePath = path.join(this.options.outDir, this.options.renameFile(hbsPath))
        await writeFileAsync(outFilePath, rendered)
      })
    )
  }
}
