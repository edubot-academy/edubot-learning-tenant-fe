import { FiDownload, FiExternalLink } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

export type MaterialPreview = {
  title: string;
  url: string;
  typeText?: string;
  context?: string;
};

type MaterialPreviewModalProps = {
  preview: MaterialPreview;
  onClose: () => void;
};

export function MaterialPreviewModal({ preview, onClose }: MaterialPreviewModalProps) {
  const { t } = useTranslation();
  const titleId = 'material-preview-modal-title';

  return (
    <Modal
      labelledBy={titleId}
      className="decision-modal material-preview-modal student-material-preview-modal"
      onClose={onClose}
    >
      <div className="modal-header-block">
        {preview.typeText ? <span>{preview.typeText}</span> : null}
        <h2 id={titleId}>{preview.title}</h2>
        {preview.context ? <p>{preview.context}</p> : null}
      </div>
      <div className="material-preview-frame student-material-preview-frame">
        <iframe
          title={preview.title}
          src={preview.url}
        />
      </div>
      <div className="modal-actions">
        <a className="secondary-link-button" href={preview.url} download><FiDownload aria-hidden="true" />{t('student.downloadMaterial')}</a>
        <a className="primary-link-button" href={preview.url} target="_blank" rel="noreferrer"><FiExternalLink aria-hidden="true" />{t('student.openInNewTab')}</a>
      </div>
    </Modal>
  );
}
