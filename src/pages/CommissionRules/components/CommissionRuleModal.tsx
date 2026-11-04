import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type CommissionRuleModalProps = ModalProps & { children?: ReactNode }

export default function CommissionRuleModal({ children, ...props }: CommissionRuleModalProps) {
  return <Modal {...props}>{children}</Modal>
}
