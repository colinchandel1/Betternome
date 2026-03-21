import React, { useState, useRef } from 'react';

const ACCEPT = '.pdf,audio/*';

export default function FileUpload({ onUpload, defaultType, allowResource }) {
  const [fileType, setFileType] = useState(defaultType || 'personal_submission');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setError('Please select a file.');

    const form = new FormData();
    form.append('file', file);
    form.append('file_type', fileType);

    setUploading(true);
    setError('');
    try {
      await onUpload(form);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
      {error && <div className="alert alert-error">{error}</div>}
      {allowResource && (
        <div className="form-group">
          <label htmlFor="file-type">Upload as</label>
          <select
            id="file-type"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
          >
            <option value="classroom_resource">Classroom Resource (visible to all students)</option>
            <option value="personal_submission">Personal Submission</option>
          </select>
        </div>
      )}
      <div className="form-group">
        <label htmlFor="file-input">File (PDF or audio)</label>
        <input
          id="file-input"
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
      </div>
      <button className="btn btn-primary" type="submit" disabled={uploading}>
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
