import React, { useState } from 'react';
import './CustomerRegistration.css';

const CustomerRegistration = ({ onComplete }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    societyName: '',
    flatNumber: '',
    age: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    if (onComplete) {
      onComplete(formData);
    }
  };

  return (
    <div className="registration-container">
      <div className="registration-card">
        {/* Decorative Top Element */}
        <div className="card-top-decoration"></div>
        
        <div className="registration-header">
          <h1 className="brand-title">SwasthFirst</h1>
          <p className="success-message">
            Scan successful! Log in to access your<br />personalized health menu.
          </p>
        </div>

        <form className="registration-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="registration-input"
            />
          </div>
          
          <div className="input-group">
            <input
              type="tel"
              name="phoneNumber"
              placeholder="Phone Number"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
              className="registration-input"
            />
          </div>

          <div className="input-group">
            <input
              type="text"
              name="societyName"
              placeholder="Society Name"
              value={formData.societyName}
              onChange={handleChange}
              required
              className="registration-input"
            />
          </div>

          <div className="input-group" style={{ display: 'flex', gap: '15px' }}>
            <input
              type="text"
              name="flatNumber"
              placeholder="Flat No."
              value={formData.flatNumber}
              onChange={handleChange}
              required
              className="registration-input"
              style={{ flex: 1 }}
            />
            <input
              type="number"
              name="age"
              placeholder="Age"
              value={formData.age}
              onChange={handleChange}
              required
              className="registration-input"
              style={{ width: '100px', flex: 'none' }}
              min="0"
            />
          </div>

          <button type="submit" className="btn-get-started">
            Get Started
          </button>
        </form>

        <div className="registration-footer">
          TABLE #04 - FRESH OUTLET
        </div>
      </div>
    </div>
  );
};

export default CustomerRegistration;
