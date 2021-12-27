import * as path from 'path'
import { generateFetchFunction } from '../../'

generateFetchFunction({
  document:  path.join(__dirname, '../spec.yaml'),
  outDir: path.join(__dirname, './dest'),
  parserOptions: {
    transformOperationId: 'camel',
    ignoreRequiredProp: true
  }
})
