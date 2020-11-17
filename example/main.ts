import * as path from 'path'
import { Parser, Renderer } from '../'

const parser = new Parser(path.join(__dirname, 'spec.yaml'), {
  schemaNamespace: 'schema',
  transformPath: (path) => path.replace(/^\/api\//, '/'),
})

const srcDir = path.join(__dirname, 'templates')
const outDir = path.join(__dirname, 'dest')

const renderer = new Renderer({ srcDir, outDir })

parser.parse().then((parsed) => renderer.render(parsed))
