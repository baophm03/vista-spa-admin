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
  if (/^\/(images|videos|files)\//.test(url)) return `${links.imageEndpoint}${url}`
  return url
}
