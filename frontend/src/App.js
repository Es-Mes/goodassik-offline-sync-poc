import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const LOCAL_API_URL = process.env.REACT_APP_LOCAL_API_URL || 'http://localhost:3001';
const CLOUD_API_URL = process.env.REACT_APP_CLOUD_API_URL || 'http://localhost:3002';

function App() {
    const [localScans, setLocalScans] = useState([]);
    const [cloudScans, setCloudScans] = useState([]);
    const [syncStatus, setSyncStatus] = useState(null);
    const [formData, setFormData] = useState({
        studentId: '',
        examId: '',
        file: null,
        uploadTo: 'local' // 'local' or 'cloud'
    });
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [editingScan, setEditingScan] = useState(null);
    const [editForm, setEditForm] = useState({ grade: '', comments: '' });

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchAllData = () => {
        fetchLocalScans();
        fetchCloudScans();
        fetchSyncStatus();
    };

    const fetchLocalScans = async () => {
        try {
            const response = await axios.get(`${LOCAL_API_URL}/local/scans`);
            setLocalScans(response.data.scans);
        } catch (error) {
            console.error('Error fetching local scans:', error);
        }
    };

    const fetchCloudScans = async () => {
        try {
            const response = await axios.get(`${CLOUD_API_URL}/api/sync/scans`);
            setCloudScans(response.data.scans);
        } catch (error) {
            console.error('Error fetching cloud scans:', error);
            setCloudScans([]); // Cloud might be offline
        }
    };

    const fetchSyncStatus = async () => {
        try {
            const response = await axios.get(`${LOCAL_API_URL}/local/sync/status`);
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

            // Choose API based on selection
            const targetUrl = formData.uploadTo === 'cloud'
                ? `${CLOUD_API_URL}/api/sync/scans/create`
                : `${LOCAL_API_URL}/local/scans`;

            await axios.post(targetUrl, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const destination = formData.uploadTo === 'cloud' ? 'ענן ☁️' : 'מקומי 💻';
            setMessage(`✅ הסריקה נשמרה בהצלחה ב${destination}!`);
            setFormData({ studentId: '', examId: '', file: null, uploadTo: 'local' });
            document.getElementById('fileInput').value = '';
            fetchAllData();
        } catch (error) {
            setMessage('❌ שגיאה בשמירת הסריקה: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleEditClick = (scan, isLocal) => {
        setEditingScan({ ...scan, isLocal });
        setEditForm({
            grade: scan.Grade || '',
            comments: scan.Comments || ''
        });
    };

    const handleEditSubmit = async () => {
        if (!editingScan) return;

        try {
            const url = editingScan.isLocal
                ? `${LOCAL_API_URL}/local/scans/${editingScan.Id}`
                : `${CLOUD_API_URL}/api/sync/scans/${editingScan.Id}`;

            await axios.patch(url, {
                grade: editForm.grade ? parseInt(editForm.grade) : null,
                comments: editForm.comments || null
            });

            setMessage(`✅ עודכן בהצלחה ב${editingScan.isLocal ? 'לוקאלי' : 'ענן'}!`);
            setEditingScan(null);
            fetchAllData();
        } catch (error) {
            setMessage('❌ שגיאה בעדכון: ' + error.message);
        }
    };

    const handleDeleteClick = async (scanId, isLocal) => {
        const location = isLocal ? 'מקומי 💻' : 'ענן ☁️';
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הסריקה מה${location}?\n\nהמחיקה תסתנכרן גם לצד השני.`)) {
            return;
        }

        try {
            const url = isLocal
                ? `${LOCAL_API_URL}/local/scans/${scanId}`
                : `${CLOUD_API_URL}/api/sync/scans/${scanId}`;

            await axios.delete(url);

            setMessage(`✅ נמחק בהצלחה מ${location}! הסריקה תימחק גם מהצד השני בקרוב.`);
            fetchAllData();
        } catch (error) {
            setMessage('❌ שגיאה במחיקה: ' + error.message);
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

    const findMatchingScan = (scan, isLocal) => {
        const otherScans = isLocal ? cloudScans : localScans;
        return otherScans.find(s => s.Id === scan.Id);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>🔄 מערכת סריקת מבחנים - Bi-Directional Sync</h1>
                <p>סנכרון דו-כיווני עם conflict resolution</p>
            </header>

            <div className="container">
                {/* Sync Status */}
                {syncStatus && (
                    <div className="sync-status">
                        <h2>📊 סטטוס סנכרון</h2>
                        <div className="status-grid">
                            <div className="status-item">
                                <span className="status-label">ממתין:</span>
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
                        <div className="form-row">
                            <div className="form-group">
                                <label>יעד העלאה:</label>
                                <div className="radio-group">
                                    <label>
                                        <input
                                            type="radio"
                                            value="local"
                                            checked={formData.uploadTo === 'local'}
                                            onChange={(e) => setFormData({ ...formData, uploadTo: e.target.value })}
                                            disabled={uploading}
                                        />
                                        💻 Local (יסתנכרן לענן)
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            value="cloud"
                                            checked={formData.uploadTo === 'cloud'}
                                            onChange={(e) => setFormData({ ...formData, uploadTo: e.target.value })}
                                            disabled={uploading}
                                        />
                                        ☁️ Cloud (יסתנכרן למקומי)
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
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
                        </div>
                        <button type="submit" disabled={uploading}>
                            {uploading ? 'מעלה...' : `שמור ב${formData.uploadTo === 'cloud' ? 'ענן ☁️' : 'מקומי 💻'}`}
                        </button>
                    </form>
                    {message && <div className="message">{message}</div>}
                </div>

                {/* Side-by-Side Scans */}
                <div className="scans-comparison">
                    <div className="scans-panel local">
                        <h2>💻 Local ({localScans.length})</h2>
                        {localScans.length === 0 ? (
                            <p className="no-data">אין סריקות</p>
                        ) : (
                            <div className="scans-list">
                                {localScans.map(scan => {
                                    const cloudMatch = findMatchingScan(scan, true);
                                    const hasConflict = cloudMatch &&
                                        (cloudMatch.Grade !== scan.Grade ||
                                            cloudMatch.Comments !== scan.Comments);

                                    return (
                                        <div key={scan.Id} className={`scan-card ${hasConflict ? 'conflict' : ''}`}>
                                            <div className="scan-header">
                                                <span className="scan-id">{scan.Id.substring(0, 8)}</span>
                                                <span
                                                    className="status-badge"
                                                    style={{ backgroundColor: getSyncStatusColor(scan.SyncStatus) }}
                                                >
                                                    {scan.SyncStatus}
                                                </span>
                                            </div>
                                            <div className="scan-info">
                                                <div><strong>תלמיד:</strong> {scan.StudentId}</div>
                                                <div><strong>מבחן:</strong> {scan.ExamId}</div>
                                                <div><strong>ציון:</strong> {scan.Grade || '-'}</div>
                                                <div><strong>הערות:</strong> {scan.Comments || '-'}</div>
                                                <div className="scan-dates">
                                                    <small>נוצר: {formatDate(scan.CreatedAt)}</small>
                                                    {scan.LastModifiedAt && (
                                                        <small>עודכן: {formatDate(scan.LastModifiedAt)}</small>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="scan-actions">
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => handleEditClick(scan, true)}
                                                >
                                                    ✏️ ערוך
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteClick(scan.Id, true)}
                                                >
                                                    🗑️ מחק
                                                </button>
                                            </div>
                                            {hasConflict && <div className="conflict-badge">⚠️ קונפליקט</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="scans-panel cloud">
                        <h2>☁️ Cloud ({cloudScans.length})</h2>
                        {cloudScans.length === 0 ? (
                            <p className="no-data">אין סריקות / ענן לא זמין</p>
                        ) : (
                            <div className="scans-list">
                                {cloudScans.map(scan => {
                                    const localMatch = findMatchingScan(scan, false);
                                    const hasConflict = localMatch &&
                                        (localMatch.Grade !== scan.grade ||
                                            localMatch.Comments !== scan.comments);

                                    return (
                                        <div key={scan.id} className={`scan-card ${hasConflict ? 'conflict' : ''}`}>
                                            <div className="scan-header">
                                                <span className="scan-id">{scan.id.substring(0, 8)}</span>
                                                <span className="status-badge synced">☁️ Cloud</span>
                                            </div>
                                            <div className="scan-info">
                                                <div><strong>תלמיד:</strong> {scan.studentid}</div>
                                                <div><strong>מבחן:</strong> {scan.examid}</div>
                                                <div><strong>ציון:</strong> {scan.grade || '-'}</div>
                                                <div><strong>הערות:</strong> {scan.comments || '-'}</div>
                                                <div className="scan-dates">
                                                    <small>נוצר: {formatDate(scan.createdat)}</small>
                                                    {scan.lastmodifiedat && (
                                                        <small>עודכן: {formatDate(scan.lastmodifiedat)}</small>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="scan-actions">
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => handleEditClick({
                                                        Id: scan.id,
                                                        StudentId: scan.studentid,
                                                        ExamId: scan.examid,
                                                        Grade: scan.grade,
                                                        Comments: scan.comments
                                                    }, false)}
                                                >
                                                    ✏️ ערוך
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteClick(scan.id, false)}
                                                >
                                                    🗑️ מחק
                                                </button>
                                            </div>
                                            {hasConflict && <div className="conflict-badge">⚠️ קונפליקט</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editingScan && (
                <div className="modal-overlay" onClick={() => setEditingScan(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>✏️ עריכת ציון והערות</h3>
                        <p><strong>מיקום:</strong> {editingScan.isLocal ? '💻 Local' : '☁️ Cloud'}</p>
                        <p><strong>תלמיד:</strong> {editingScan.StudentId}</p>
                        <p><strong>מבחן:</strong> {editingScan.ExamId}</p>

                        <div className="form-group">
                            <label>ציון:</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={editForm.grade}
                                onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                                placeholder="0-100"
                            />
                        </div>

                        <div className="form-group">
                            <label>הערות:</label>
                            <textarea
                                value={editForm.comments}
                                onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                                placeholder="הערות על הסריקה..."
                                rows="4"
                            />
                        </div>

                        <div className="modal-actions">
                            <button onClick={handleEditSubmit}>💾 שמור</button>
                            <button onClick={() => setEditingScan(null)} className="cancel-btn">✖️ ביטול</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
