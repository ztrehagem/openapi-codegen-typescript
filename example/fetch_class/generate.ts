import * as path from 'path'
import { generateFetchClass } from '../../'

generateFetchClass({
  document: path.join(__dirname, '../spec.yaml'),
  outDir: path.join(__dirname, './dest'),
  parserOptions: {
    transformOperationId: 'camel',
    ignoreRequiredProp: {
      parameters: false,
      schemas: true,
    },
  },
})
