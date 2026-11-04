import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type DiscountRuleModalProps = ModalProps & { children?: ReactNode }

export default function DiscountRuleModal({ children, ...props }: DiscountRuleModalProps) {
  return <Modal {...props}>{children}</Modal>
}
