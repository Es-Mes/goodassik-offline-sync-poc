import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_LOCAL_API_URL || 'http://localhost:3001';

function App() {
    const [scans, setScans] = useState([]);
    const [syncStatus, setSyncStatus] = useState(null);
    const [formData, setFormData] = useState({
        studentId: '',
        examId: '',
        file: null
    });
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchScans();
        fetchSyncStatus();
        const interval = setInterval(() => {
            fetchScans();
            fetchSyncStatus();
        }, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchScans = async () => {
        try {
            const response = await axios.get(`${API_URL}/local/scans`);
            setScans(response.data.scans);
        } catch (error) {
            console.error('Error fetching scans:', error);
        }
    };

    const fetchSyncStatus = async () => {
        try {
            const response = await axios.get(`${API_URL}/local/sync/status`);
            setSyncStatus(response.data.status);
        } catch (error) {
            console.error('Error fetching sync status:', error);
        }
    };

    const handleFileChange = (e) => {
        setFormData({ ...formData, file: e.target.files[0] });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.studentId || !formData.examId || !formData.file) {
            setMessage('נא למלא את כל השדות');
            return;
        }

        setUploading(true);
        setMessage('');

        try {
            const data = new FormData();
            data.append('studentId', formData.studentId);
            data.append('examId', formData.examId);
            data.append('image', formData.file);

            await axios.post(`${API_URL}/local/scans`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setMessage('✅ הסריקה נשמרה בהצלחה!');
            setFormData({ studentId: '', examId: '', file: null });

            // Reset file input
            document.getElementById('fileInput').value = '';

            fetchScans();
            fetchSyncStatus();
        } catch (error) {
            setMessage('❌ שגיאה בשמירת הסריקה: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const getSyncStatusColor = (status) => {
        switch (status) {
            case 'Synced': return '#4caf50';
            case 'Pending': return '#ff9800';
            case 'Syncing': return '#2196f3';
            case 'Failed': return '#f44336';
            default: return '#757575';
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>מערכת סריקת מבחנים - POC</h1>
                <p>מצב אונליין/אופליין עם סנכרון אוטומטי</p>
            </header>

            <div className="container">
                {/* Sync Status */}
                {syncStatus && (
                    <div className="sync-status">
                        <h2>📊 סטטוס סנכרון</h2>
                        <div className="status-grid">
                            <div className="status-item">
                                <span className="status-label">ממתין לסנכרון:</span>
                                <span className="status-value pending">{syncStatus.pending}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">מסתנכרן:</span>
                                <span className="status-value syncing">{syncStatus.inProgress}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">סונכרן:</span>
                                <span className="status-value synced">{syncStatus.synced}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">נכשל:</span>
                                <span className="status-value failed">{syncStatus.failed}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Form */}
                <div className="upload-section">
                    <h2>📤 העלאת סריקה חדשה</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>מזהה תלמיד:</label>
                            <input
                                type="text"
                                value={formData.studentId}
                                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                                placeholder="לדוגמה: 123456"
                                disabled={uploading}
                            />
                        </div>
                        <div className="form-group">
                            <label>מזהה מבחן:</label>
                            <input
                                type="text"
                                value={formData.examId}
                                onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                                placeholder="לדוגמה: MATH-2024-Q1"
                                disabled={uploading}
                            />
                        </div>
                        <div className="form-group">
                            <label>קובץ תמונה:</label>
                            <input
                                id="fileInput"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={uploading}
                            />
                        </div>
                        <button type="submit" disabled={uploading}>
                            {uploading ? 'מעלה...' : 'שמור סריקה'}
                        </button>
                    </form>
                    {message && <div className="message">{message}</div>}
                </div>

                {/* Scans List */}
                <div className="scans-section">
                    <h2>📋 סריקות שנשמרו ({scans.length})</h2>
                    {scans.length === 0 ? (
                        <p className="no-data">אין סריקות עדיין</p>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>מזהה</th>
                                        <th>תלמיד</th>
                                        <th>מבחן</th>
                                        <th>תאריך</th>
                                        <th>סטטוס סנכרון</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scans.map((scan) => (
                                        <tr key={scan.Id}>
                                            <td>{scan.Id.substring(0, 8)}...</td>
                                            <td>{scan.StudentId}</td>
                                            <td>{scan.ExamId}</td>
                                            <td>{new Date(scan.CreatedAt).toLocaleString('he-IL')}</td>
                                            <td>
                                                <span
                                                    className="status-badge"
                                                    style={{ backgroundColor: getSyncStatusColor(scan.SyncStatus) }}
                                                >
                                                    {scan.SyncStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
