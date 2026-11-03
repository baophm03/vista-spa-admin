const links = {
  // apiEndpoint: 'http://localhost:3001',
  // siteUrl: 'http://localhost:5173',
  // imageEndpoint: 'http://localhost:3001',

  // Production
  apiEndpoint: 'https://vista-spa.vietprodev.com',
  siteUrl: 'https://vista-spa.vercel.app',
  imageEndpoint: 'https://vista-spa.vietprodev.com',
}

export default links

export function resolveFileUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  // Dữ liệu cũ có thể lưu dấu backslash (\images\...) — chuẩn hóa về forward slash
  const normalized = url.replace(/\\/g, '/')
  if (/^\/(images|videos|files)\//.test(normalized)) {
    // Dev: vite proxy đã dẫn /images|videos|files về backend — giữ nguyên để không sai origin.
    // Production build: ghép với imageEndpoint của backend.
    if (import.meta.env.DEV) return normalized
    return `${links.imageEndpoint}${normalized}`
  }
  return normalized
}
