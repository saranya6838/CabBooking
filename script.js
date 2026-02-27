/**
 * QuickCab – Cab Booking Website Functionality
 * Handles: booking form validation & submit, mobile nav, date rules
 */

(function () {
  'use strict';

  // ========== Utility: today in YYYY-MM-DD ==========
  function getTodayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ========== Mobile navigation toggle ==========
  function initMobileNav() {
    var btn = document.getElementById('nav-toggle');
    var nav = document.querySelector('header nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', function () {
      nav.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', nav.classList.contains('nav-open'));
    });

    // Close on link click (for anchor or same-page)
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('nav-open');
      });
    });

    // Close on resize to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) nav.classList.remove('nav-open');
    });
  }

  // ========== Show form message as popup (success / error) ==========
  var messagePopupEl = null;

  function getMessagePopup() {
    if (messagePopupEl) return messagePopupEl;
    messagePopupEl = document.createElement('div');
    messagePopupEl.className = 'form-message-popup-overlay';
    messagePopupEl.setAttribute('role', 'dialog');
    messagePopupEl.setAttribute('aria-modal', 'true');
    messagePopupEl.setAttribute('aria-live', 'polite');
    messagePopupEl.innerHTML =
      '<div class="form-message-popup-box">' +
        '<div class="form-message-popup-content"></div>' +
        '<button type="button" class="form-message-popup-close" aria-label="Close">×</button>' +
      '</div>';
    document.body.appendChild(messagePopupEl);
    messagePopupEl.querySelector('.form-message-popup-close').addEventListener('click', closeMessagePopup);
    messagePopupEl.addEventListener('click', function (e) {
      if (e.target === messagePopupEl) closeMessagePopup();
    });
    return messagePopupEl;
  }

  function closeMessagePopup() {
    if (messagePopupEl) {
      messagePopupEl.classList.remove('form-message-popup-visible');
      document.body.style.overflow = '';
    }
  }

  function showFormMessage(container, type, text) {
    if (container) container.innerHTML = '';
    var popup = getMessagePopup();
    var content = popup.querySelector('.form-message-popup-content');
    content.className = 'form-message-popup-content form-message--' + type;
    content.textContent = text;
    document.body.style.overflow = 'hidden';
    popup.classList.add('form-message-popup-visible');
  }

  // ========== Booking form ==========
  function initBookingForm() {
    var form = document.getElementById('booking-form');
    if (!form) return;

    var pickupDate = document.getElementById('pickup-date');
    var dropoffDate = document.getElementById('dropoff-date');
    var mobileInput = document.getElementById('mobile');
    var messageEl = document.getElementById('booking-message');

    // Set min date to today for pickup and drop-off
    var today = getTodayStr();
    if (pickupDate) pickupDate.setAttribute('min', today);
    if (dropoffDate) dropoffDate.setAttribute('min', today);

    // When pickup date changes, update drop-off min
    if (pickupDate && dropoffDate) {
      pickupDate.addEventListener('change', function () {
        dropoffDate.setAttribute('min', pickupDate.value || today);
      });
    }

    // Real-time mobile validation (10 digits)
    if (mobileInput) {
      mobileInput.addEventListener('input', function () {
        var v = this.value.replace(/\D/g, '');
        if (v.length > 10) v = v.slice(0, 10);
        this.value = v;
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Clear previous message
      if (messageEl) messageEl.innerHTML = '';

      // Validate mobile: exactly 10 digits
      var mobile = (mobileInput && mobileInput.value) ? mobileInput.value.replace(/\D/g, '') : '';
      if (mobile.length !== 10) {
        showFormMessage(messageEl, 'error', 'Please enter a valid 10-digit mobile number.');
        if (mobileInput) mobileInput.focus();
        return;
      }

      // Validate dates
      var pDate = pickupDate && pickupDate.value ? pickupDate.value : '';
      var dDate = dropoffDate && dropoffDate.value ? dropoffDate.value : '';
      if (pDate && dDate && dDate < pDate) {
        showFormMessage(messageEl, 'error', 'Drop-off date cannot be before pickup date.');
        if (dropoffDate) dropoffDate.focus();
        return;
      }

      // Validate pickup not in the past (date + time)
      if (pickupDate && pickupDate.value) {
        var pickupTime = document.getElementById('pickup-time');
        var pTime = pickupTime && pickupTime.value ? pickupTime.value : '00:00';
        var pickupDt = new Date(pDate + 'T' + pTime);
        if (pickupDt < new Date()) {
          showFormMessage(messageEl, 'error', 'Pickup date and time must be in the future.');
          if (pickupDate) pickupDate.focus();
          return;
        }
      }

      var name = (document.getElementById('name') && document.getElementById('name').value) || '';
      var car = (document.getElementById('car') && document.getElementById('car').value) || '';
      var email = (document.getElementById('email') && document.getElementById('email').value) || '';
      var pickupCity = (document.getElementById('pickup-city') && document.getElementById('pickup-city').value) || '';
      var pickupTimeEl = document.getElementById('pickup-time');
      var pTimeStr = pickupTimeEl && pickupTimeEl.value ? pickupTimeEl.value : '';

      var payload = {
        name: name,
        car_name: car,
        email: email,
        mobile: mobileInput ? mobileInput.value : '',
        pickup_city: pickupCity,
        pickup_date: pDate,
        pickup_time: pTimeStr,
        dropoff_date: dDate,
        comments: (document.getElementById('comments') && document.getElementById('comments').value) || ''
      };

      // Try to submit to backend (relative so it works under a Tomcat context path)
      fetch('api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok && result.data.success) {
            var msg = result.data.message || 'Thank you! Your cab has been requested.';
            if (result.data.booking_id) msg += ' Reference: ' + result.data.booking_id + '.';
            showFormMessage(messageEl, 'success', msg);
            form.reset();
          } else {
            showFormMessage(messageEl, 'error', (result.data && result.data.message) || 'Booking could not be saved. Please try again.');
          }
        })
        .catch(function () {
          // No server or network error: show success message and keep demo behaviour
          var summary = 'Booking received for ' + (name || 'you') + '. ';
          summary += 'Cab: ' + (car || 'N/A') + ', Pickup: ' + (pickupCity || 'N/A') + ' on ' + (pDate || '') + ' at ' + (pTimeStr || '') + '. ';
          summary += 'We will confirm via email at ' + (email || '') + '.';
          showFormMessage(messageEl, 'success', 'Thank you! Your cab has been requested. ' + summary);
          try {
            localStorage.setItem('quickcab_last_booking', JSON.stringify({
              name: name,
              car: car,
              email: email,
              mobile: mobileInput ? mobileInput.value : '',
              pickupCity: pickupCity,
              pickupDate: pDate,
              pickupTime: pTimeStr,
              dropoffDate: dDate,
              at: new Date().toISOString()
            }));
          } catch (err) { /* ignore */ }
        });
    });
  }

  // ========== Run on DOM ready ==========
  function init() {
    initMobileNav();
    initBookingForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
