import { Trash2, Download, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import './HistoryPage.css';

import SampleVideo from './Sample_video.mp4';
import facebookImg from './vecteezy_facebook-logo-png-facebook-icon-transparent-white-background_41643208.png';
import instagramImg from './vecteezy_instagram-logo-png-instagram-icon-transparent_18930413.png';
import linkedinImg from './vecteezy_linkedin-logo-png-linkedin-icon-transparent-png_18930480.png';
import twitterImg from './vecteezy_twitter-png-icon_16716486.png';

import NavBar from '../components/NavBar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


const HistoryTable = ({ data, title, typeColor, onDownload, onDelete }) => (
  <div className="history-section">
    <div className="section-header">
      <h2 className={`section-title ${typeColor}`}>{title}</h2>
      <span className="section-count">{data.length} files</span>
    </div>

    {data.length > 0 ? (
      <table className="history-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Partner</th>
            <th>Size</th>
            <th>Date & Time</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="history-row">
              <td className="file-name">
                <FileText size={18} className="file-icon" />
                <span>{item.fileName}</span>
              </td>

              <td>{item.partnerName}</td>

              <td>{item.size}</td>

              <td>
                <div className="date-time">
                  <div>{item.transferDate}</div>
                  <div className="time">{item.transferTime}</div>
                </div>
              </td>

              <td>
                <span className={`status-badge ${item.status}`}>
                  {item.status}
                </span>
              </td>

              <td className="actions">
                <button
                  type="button"
                  className="action-btn download-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownload(item.id);
                  }}
                  title="Download this file"
                >
                  <Download size={18} />
                </button>

                <button
                  type="button"
                  className="action-btn delete-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item.id);
                  }}
                  title="Delete this file"
                >
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="empty-state-section">
        <FileText size={36} />
        <p>No {title.toLowerCase()}</p>
      </div>
    )}
  </div>
);

const HistoryPage = ({ user, onLogout }) => {
  const [transferHistory, setTransferHistory] = useState([]);

  // 🔥 FETCH DATA FROM BACKEND
  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');

      if (!token) return;

      try {
        const res = await axios.get(`${API_URL}/api/files`, {
          headers: {
            Authorization: token
          }
        });

        const currentUserId = user?.id || localStorage.getItem('userId');

        const formattedData = res.data.files.map(file => {
          const senderId = file.userId?._id?.toString() || file.userId?.toString();
          const receiverId = file.receiverId?._id?.toString() || file.receiverId?.toString();
          
          // 🔥 USE transferType FIELD IF AVAILABLE, OTHERWISE FALL BACK TO DIRECTION LOGIC
          let direction;
          if (file.transferType === 'send') {
            direction = 'uploaded';
          } else if (file.transferType === 'receive') {
            direction = 'received';
          } else {
            // Fallback to old logic for compatibility
            direction = senderId === currentUserId ? 'uploaded' : receiverId === currentUserId ? 'received' : 'unknown';
          }
          
          const partnerName = direction === 'uploaded'
            ? file.receiverId?.username || file.receiverId
            : file.userId?.username || file.userId;

          const filePath = file.path || `/uploads/${file.filename}`;
          const downloadUrl = `${API_URL}${filePath}`;

          console.log('File:', file.filename, 'Original Name:', file.originalName, 'Size:', file.size, 'URL:', downloadUrl);

          return {
            id: file._id,
            fileName: file.originalName,
            size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            transferDate: new Date(file.uploadedAt)
              .toISOString()
              .split('T')[0],
            transferTime: new Date(file.uploadedAt)
              .toTimeString()
              .split(' ')[0],
            type: file.fileCategory,
            status: 'completed',
            direction,
            partnerName: partnerName || 'Unknown',
            downloadUrl,
            originalName: file.originalName,
            mimeType: file.mimeType
          };
        });

        setTransferHistory(formattedData);

      } catch (error) {
        console.error('Error fetching history:', error);
      }
    };

    fetchHistory();
  }, [user]);

  const handleDelete = async (id) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Delete failed: missing token');
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/files/${id}`, {
        headers: { Authorization: token }
      });

      setTransferHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const handleDownload = async (id) => {
    try {
      console.log('=== DOWNLOAD STARTED FOR ID:', id);
      
      const fileToDownload = transferHistory.find(item => item.id === id);
      console.log('File to download:', fileToDownload);
      
      if (!fileToDownload) {
        alert('File not found in history');
        return;
      }

      const token = localStorage.getItem('token');
      console.log('Token exists:', !!token);
      
      if (!token) {
        alert('Please login first to download');
        return;
      }

      // Use new authenticated download endpoint
      const downloadUrl = `${API_URL}/api/files/${id}/download`;
      console.log('Download URL:', downloadUrl);

      console.log('Attempting to fetch:', downloadUrl);
      
      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        headers: {
          Authorization: token
        },
        timeout: 30000
      });

      console.log('Response received!');
      console.log('Status:', response.status);
      console.log('Blob size:', response.data.size);
      console.log('Content-Type:', response.headers['content-type']);

      if (!response.data || response.data.size === 0) {
        alert('No data received from server');
        return;
      }

      // Create and trigger download
      const url = window.URL.createObjectURL(response.data);
      console.log('Object URL created:', url);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileToDownload.originalName || fileToDownload.fileName || `download_${id}`;
      
      console.log('Download filename:', link.download);
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log('=== DOWNLOAD COMPLETED ===');
        alert('Download completed!');
      }, 100);

    } catch (error) {
      console.error('=== DOWNLOAD ERROR ===');
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Full error:', error);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      alert(`Download failed: ${error.message}`);
    }
  };

  const uploadedFiles = transferHistory.filter(item => item.direction === 'uploaded');
  const receivedFiles = transferHistory.filter(item => item.direction === 'received');

  return (
    <>
      <NavBar isLoggedIn={Boolean(user)} onLogout={onLogout} />

      <video className="background-video" autoPlay loop muted playsInline>
        <source src={SampleVideo} type="video/mp4" />
      </video>

      <div className="background-overlay"></div>

      <div className="history-page-container">
        <div className="history-content">

          <div className="history-header">
            <h1 className="history-title">Transfer History</h1>
            <p className="history-subtitle">
              View and manage your file transfer records
            </p>
          </div>

          {/* Uploaded */}
          <HistoryTable
            data={uploadedFiles}
            title="Uploaded Files"
            typeColor="uploaded"
            onDownload={handleDownload}
            onDelete={handleDelete}
          />

          {/* Received */}
          <HistoryTable
            data={receivedFiles}
            title="Received Files"
            typeColor="received"
            onDownload={handleDownload}
            onDelete={handleDelete}
          />

          {/* Empty */}
          {transferHistory.length === 0 && (
            <div className="empty-state">
              <FileText size={48} />
              <p>No transfer history yet</p>
              <span>Your file transfers will appear here</span>
            </div>
          )}

        </div>
      </div>

      <footer className="footer-section">
        <div className="footer-container">
          <section className="about-us-section">
            <div className="about-container">
              <div className="about-text">
                <h3>About DropIt</h3>
                <p>
                  DropIt is a revolutionary file-sharing platform powered by gesture recognition technology.
                  We enable touchless, high-speed file transfers with real-time tracking and device recognition.
                  Experience the future of secure and efficient file sharing.
                </p>
              </div>
            </div>
          </section>

          <div className="footer-content">
            <div className="footer-column">
              <h5>Features</h5>
              <ul className="footer-links">
                <li><a href="#gesture">Gesture Recognition</a></li>
                <li><a href="#transfer">High-Speed Transfer</a></li>
                <li><a href="#history">Transfer History</a></li>
                <li><a href="#security">Secure Sharing</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h5>Quick Links</h5>
              <ul className="footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/home">Upload</a></li>
                <li><a href="/drop">Drop</a></li>
                <li><a href="/history">History</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h5>Contact Us</h5>
              <div className="contact-info">
                <p><strong>Email:</strong> jamilahmed9500@gmail.com</p>
                <p><strong>Phone:</strong> +88001732856095</p>
                <p><strong>Address:</strong> PAJAMA TECH , Dhaka City</p>
              </div>
            </div>

            <div className="footer-column">
              <h5>Follow Us</h5>
              <div className="social-links">
                <a href="#facebook" className="social-icon">
                  <img src={facebookImg} alt="Facebook" />
                </a>
                <a href="#twitter" className="social-icon">
                  <img src={twitterImg} alt="Twitter" />
                </a>
                <a href="#linkedin" className="social-icon">
                  <img src={linkedinImg} alt="LinkedIn" />
                </a>
                <a href="#instagram" className="social-icon">
                  <img src={instagramImg} alt="Instagram" />
                </a>
              </div>
            </div>
          </div>

          <div className="footer-copyright">
            <p>&copy; 2026 DropIt. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default HistoryPage;