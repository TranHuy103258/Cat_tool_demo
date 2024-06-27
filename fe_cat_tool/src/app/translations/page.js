// src/app/translations/page.js

"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

export default function Translations() {
  const [segments, setSegments] = useState([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const collection = searchParams.get('collection');

  useEffect(() => {
    if (collection) {
      fetchTranslations();
    }
  }, [collection]);

  const fetchTranslations = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/translations/${collection}`);
      setSegments(response.data);
    } catch (error) {
      console.error('Error fetching translations:', error);
    }
  };

  const handleBlur = async (id, translation) => {
    try {
      await axios.put(`http://localhost:3001/translations/${collection}/${id}`, { translation });
    } catch (error) {
      console.error('Error updating translation:', error);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await axios.post(`http://localhost:3001/download/${collection}`, {}, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `translated_${collection}.docx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <div className="container">
      <h1>Translations</h1>
      <button onClick={handleDownload}>Download Translated File</button>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Original Text</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment, index) => (
              <tr key={segment._id}>
                <td>{index + 1}</td>
                <td>{segment.original}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Translation</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment, index) => (
              <tr key={segment._id}>
                <td>{index + 1}</td>
                <td
                  className="editable"
                  contentEditable
                  onBlur={(e) => handleBlur(segment._id, e.target.innerText)}
                >
                  {segment.translation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
