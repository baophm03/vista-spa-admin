import 'dotenv/config'
import { defineConfig } from 'orval'
import links from './src/configs/links'

const orvalConfig = defineConfig({
  'vista': {
    output: {
      mode: 'tags',
      target: 'src/api/endpoints',
      schemas: 'src/api/models',
      client: 'react-query',
      clean: true,
      override: {
        query: {
          version: 5,
          useInfinite: true,
          usePrefetch: true,
          options: {
            retry: 3,
            retryDelay: 1000,
          }
        },
        mutator: {
          path: './src/api/mutator/custom-instance.ts',
          name: 'customInstance'
        }
      }
    },
    input: {
      target: `${links.apiEndpoint}/swagger/swagger-output.json`,
    }
  }
})

export default orvalConfig