import * as path from 'path'
import { Parser, Renderer } from '../../../'

const parser = new Parser(path.join(__dirname, 'spec.yaml'), {
  schemaNamespace: 'schema',
})

const renderer = new Renderer({
  srcDir: path.join(__dirname, '../templates'),
  outDir: path.join(__dirname, 'dest'),
  srcFileGlob: ['**/*.ts.hbs', '**/*.ts'],
})

parser.parse().then((parsed) => renderer.render(parsed))
