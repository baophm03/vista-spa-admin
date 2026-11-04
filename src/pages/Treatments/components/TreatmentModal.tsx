import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type TreatmentModalProps = ModalProps & { children?: ReactNode }

export default function TreatmentModal({ children, ...props }: TreatmentModalProps) {
  return <Modal {...props}>{children}</Modal>
}
