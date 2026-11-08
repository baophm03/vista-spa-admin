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
      // Mặc định lấy swagger từ BE đang chạy; có thể trỏ vào file JSON tĩnh
      // (sinh bằng `node lib/swagger/generate.js` ở vista-spa-be) qua ORVAL_TARGET
      // khi không tiện bật server, ví dụ:
      //   ORVAL_TARGET=../vista-spa-be/storage/swagger/swagger-output.json pnpm gen:api
      target: process.env.ORVAL_TARGET || `${links.apiEndpoint}/swagger/swagger-output.json`,
      filters: {
        tags: undefined
      }
    }
  }
})

export default orvalConfig