import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import axios from 'axios';
import {
  AlertCircle, CheckCircle2, Loader2, UploadCloud, FileText
} from 'lucide-react';

const API = 'https://mentalwatch-production.up.railway.app';

const ErrorBox = ({ msg }) => msg ? <div className="input-error"><AlertCircle size={15} />{msg}</div> : null;
const AnalyzeBtn = ({ onClick, disabled, loading, label = 'Analyze' }) => (
  <button className="btn btn-primary analyze-btn" onClick={onClick} disabled={disabled || loading}>
    {loading && <Loader2 size={18} className="spin-icon" />} {loading ? 'Analyzing…' : label}
  </button>
);

const UploadPage = () => {
  const { setAnalyzedData, loading, setLoading } = useData();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const accept = (f) => { 
    if (f?.name?.toLowerCase().match(/\.(csv|xlsx|xls)$/)) { 
      setFile(f); 
      setError(null); 
    } else {
      setError('Only .csv, .xlsx, or .xls files are accepted.'); 
    }
  };
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); }, []);
  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    const fd = new FormData(); fd.append('file', file);
    try { 
      const { data } = await axios.post(`${API}/analyze/csv`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); 
      setAnalyzedData(data); 
      navigate('/'); // Go back to dashboard to see results
    } catch (e) { 
      setError('Upload failed. Check your file format.'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="upload-page-wrapper">
      <div className="upload-header">
        <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Upload Dataset</h1>
        <p className="page-subtitle" style={{ marginBottom: 0 }}>
          Upload a CSV or Excel file to analyze mental health deterioration.
        </p>
      </div>

      <div className="input-card glass-panel">
        <div className="tab-bar">
          <button className="tab-btn active" style={{ '--tab-color': '#3b82f6' }}>
            <FileText size={16} /> Dataset Upload
          </button>
        </div>
        <div className="tab-content">
          <div className="tab-body">
            <p className="tab-desc">File should contain username, post_text, timestamp columns.</p>
            <div className={`drop-zone ${file ? 'active' : ''} ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => document.getElementById('csv-file-input').click()}>
              <input id="csv-file-input" type="file" accept=".csv, .xlsx, .xls" onChange={(e) => accept(e.target.files[0])} style={{display:'none'}} />
              <UploadCloud className="upload-icon" />
              {file ? <div className="file-selected"><CheckCircle2 size={18} style={{ color: 'var(--color-normal)' }} /> {file.name}</div> : <><div className="drop-title">Drop CSV or Excel here or click to browse</div><div className="drop-hint">Max 50 MB</div></>}
            </div>
            <ErrorBox msg={error} />
            <AnalyzeBtn onClick={handleAnalyze} disabled={!file} loading={loading} label="Analyze File" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
