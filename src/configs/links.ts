const links = {
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || 'http://localhost:3001',
  siteUrl: import.meta.env.VITE_SITE_URL || 'http://localhost:5173',
  imageEndpoint: import.meta.env.VITE_IMAGE_ENDPOINT || 'http://localhost:3001',
}

export default links