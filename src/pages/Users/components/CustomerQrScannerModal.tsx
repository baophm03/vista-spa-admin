import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { Alert, Button, Modal, Space, Typography } from 'antd'
import { CameraOutlined } from '@ant-design/icons'
import { errorMessage } from '@/api/helpers'

interface Props {
  open: boolean
  onClose: () => void
  onToken: (token: string) => void
}

export default function CustomerQrScannerModal({ open, onClose, onToken }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const onTokenRef = useRef(onToken)
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!open || !scanning || !videoRef.current) return
    let disposed = false
    setCameraError('')
    const reader = new BrowserQRCodeReader()
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _error, controls) => {
      controlsRef.current = controls
      if (!result) return
      const value = result.getText().trim()
      if (!value) return
      controls.stop()
      controlsRef.current = null
      setScanning(false)
      onTokenRef.current(value)
    }).then((controls) => {
      if (disposed) controls.stop()
      else controlsRef.current = controls
    }).catch((error: unknown) => {
      if (disposed) return
      setScanning(false)
      setCameraError(errorMessage(error, 'Không thể mở camera. Hãy kiểm tra quyền camera hoặc nhập token bên dưới.'))
    })
    return () => {
      disposed = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open, scanning])

  const close = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
    setCameraError('')
    onClose()
  }

  return (
    <Modal
      title="Quét QR khách hàng"
      open={open}
      onCancel={close}
      footer={null}
      destroyOnHidden
      width={480}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Typography.Text type="secondary">Bật camera để quét mã, hoặc nhập token QR nếu camera không dùng được.</Typography.Text>
        {cameraError && <Alert type="warning" showIcon message={cameraError} />}
        <div style={{ display: scanning ? 'block' : 'none', overflow: 'hidden', borderRadius: 12, background: '#121212' }}>
          <video ref={videoRef} muted playsInline style={{ display: 'block', width: '100%', maxHeight: 300, objectFit: 'cover' }} />
        </div>
        <Space wrap>
          <Button icon={<CameraOutlined />} type="primary" onClick={() => setScanning(true)} disabled={scanning}>
            {cameraError ? 'Thử bật camera lại' : 'Bật camera'}
          </Button>
          {scanning && <Button onClick={() => { controlsRef.current?.stop(); controlsRef.current = null; setScanning(false) }}>Dừng camera</Button>}
        </Space>
      </Space>
    </Modal>
  )
}
