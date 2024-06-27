"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import styles from '@/app/Home.module.css';

export default function Home() {
  const [translations, setTranslations] = useState([]);
  const [collectionName, setCollectionName] = useState('');

  const fetchTranslations = async (collectionName) => {
    const response = await axios.get(`http://localhost:3001/translations/${collectionName}`);
    setTranslations(response.data);
  };

  const handleBlur = async (id, translation) => {
    await axios.put(`http://localhost:3001/translations/${collectionName}/${id}`, { translation });
  };

  const handleFileUpload = async (e) => {
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    const response = await axios.post('http://localhost:3001/upload', formData);
    setCollectionName(response.data.collectionName);
    fetchTranslations(response.data.collectionName);
  };

  return (
    <div className={styles.container}>
      <h1>CAT Tool</h1>
      <input type="file" clasName={styles.input} onChange={handleFileUpload} />
      <div className={styles.tableContainer}>
        <div className={styles.column}>
          <h2>Original Text</h2>
          {translations.map((t, index) => (
            <div key={t._id} className={styles.row}>
              <div className={styles.number}>{index + 1}</div>
              <div>{t.original}</div>
            </div>
          ))}
        </div>
        <div className={styles.column}>
          <h2>Translation</h2>
          {translations.map((t, index) => (
            <div key={t._id} className={styles.row}>
              <div className={styles.number}>{index + 1}</div>
              <div
                contentEditable
                onBlur={e => handleBlur(t._id, e.target.innerText)}
              >
                {t.translation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
