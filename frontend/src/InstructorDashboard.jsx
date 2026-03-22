
import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function InstructorDashboard() {
	const navigate = useNavigate();
	const token = localStorage.getItem('token');
	let role = null;
	let username = '';
	if (token) {
		try {
			const payload = JSON.parse(atob(token.split('.')[1]));
			role = payload.role;
			username = payload.username;
		} catch (e) {}
	}

	const [className, setClassName] = useState('');
	const [uploadClass, setUploadClass] = useState('');
    const [error, setError] = useState('');
	const [file, setFile] = useState(null);
	const [message, setMessage] = useState('');
	const fileInputRef = useRef();

	useEffect(() => {
		if (!token) {
			alert('You must log in first');
			navigate('/login');
		} else if (role !== 1) {
			// Not an instructor, redirect to student dashboard
			navigate('/dashboard');
		}
	}, [token, role, navigate]);

	if (!token || role !== 1) {
		return null;
	}

	const startTeaching = () => {
		fetch('http://localhost:8000/start-teaching', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
			body: JSON.stringify({ class_name: className })
		})
			.then(async (response) => {
				const data = await response.json();
				if (response.ok) {
					setMessage(data.message);
				} else {
					setMessage(data.detail || 'Failed to start teaching');
				}
			});
	};

	const uploadMusicSheet = () => {
		if (!file || !uploadClass) {
			setMessage('Please select a class and a PDF file.');
			return;
		}
		const formData = new FormData();
		formData.append('class_name', uploadClass);
		formData.append('file', file);
		fetch('http://localhost:8000/upload-music-score', {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${token}` },
			body: formData
		})
			.then(async (response) => {
				const data = await response.json();
				if (response.ok) {
					setMessage('Upload successful!');
					setFile(null);
					if (fileInputRef.current) fileInputRef.current.value = '';
				} else {
					setMessage(data.detail || 'Upload failed');
				}
			});
	};

	return (
		<div>
			<h1>Welcome Instructor {username}!</h1>
			<p>This is the instructor dashboard.</p>
			{message && <p style={{ color: 'blue' }}>{message}</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <Link to="/">
                <button>Back to Home</button>
            </Link>
            <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>Logout</button>
			<div style={{ margin: '1em 0' }}>
				<input
					type="text"
					placeholder="Class name to teach"
					value={className}
					onChange={e => setClassName(e.target.value)}
				/>
				<button onClick={startTeaching}>Start Teaching (Sandbox)</button>
			</div>
			<div style={{ margin: '1em 0' }}>
				<input
					type="text"
					placeholder="Class ID for upload"
					value={uploadClass}
					onChange={e => setUploadClass(e.target.value)}
				/>
				<input
					type="file"
					accept="application/pdf"
					ref={fileInputRef}
					onChange={e => setFile(e.target.files[0])}
				/>
				<button onClick={uploadMusicSheet}>Upload Music Sheet (PDF)</button>
			</div>
		</div>
	);
}

export default InstructorDashboard;
