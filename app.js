(function() {
  const canvas = document.getElementById('wheel');
  const ctx = canvas.getContext('2d');
  const spinBtn = document.getElementById('spinBtn');
  const quickPickBtn = document.getElementById('quickPickBtn');
  const clearBtn = document.getElementById('clearBtn');
  const addBtn = document.getElementById('addBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');
  const nameInput = document.getElementById('watchName');
  const notesInput = document.getElementById('watchNotes');
  const photoInput = document.getElementById('watchPhoto');
  const previewText = document.getElementById('previewText');
  const watchList = document.getElementById('watchList');
  const result = document.getElementById('result');
  const installModal = document.getElementById('installModal');
  const installHelpBtn = document.getElementById('installHelpBtn');
  const closeInstallBtn = document.getElementById('closeInstallBtn');

  const STORAGE_KEY = 'wristRouletteLocalOnlyV1';
  let watches = [];
  try {
    watches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch(e) {
    watches = [];
  }

  let selectedPhoto = null;
  let rotation = 0;
  let spinning = false;
  const colors = ['#d72638', '#246bfe', '#f5b942', '#24c27a', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'];

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
      return true;
    } catch(e) {
      alert('Storage is full for this app. Export a backup, then delete a few watches/photos.');
      return false;
    }
  }

  function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }

          const off = document.createElement('canvas');
          off.width = width;
          off.height = height;
          const offCtx = off.getContext('2d');
          offCtx.drawImage(img, 0, 0, width, height);

          let dataUrl;
          try {
            dataUrl = off.toDataURL('image/jpeg', quality);
          } catch(err) {
            dataUrl = e.target.result;
          }
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    drawWheel();
  }

  function drawWheel() {
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
    ctx.clearRect(0,0,w,h);

    if (watches.length === 0) {
      ctx.fillStyle = '#202431';
      ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4f4f5'; ctx.font = `${Math.max(18, w/22)}px Arial`; ctx.textAlign = 'center';
      ctx.fillText('Add watches', cx, cy - 8); ctx.fillText('to start', cx, cy + 34);
      return;
    }

    const slice = (Math.PI * 2) / watches.length;

    watches.forEach((watch, i) => {
      const start = i * slice, end = start + slice;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r - 5, start, end); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(2, w / 220); ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(13, w/34)}px Arial`;
      ctx.shadowColor = 'rgba(0,0,0,.7)';
      ctx.shadowBlur = 4;
      const text = watch.name.length > 18 ? watch.name.slice(0, 17) + '…' : watch.name;
      ctx.fillText(text, r - 28, 6);
      ctx.restore();
    });
  }

  function renderList() {
    watchList.innerHTML = '';
    if (!watches.length) {
      watchList.innerHTML = '<div class="hint">No watches added yet. Add photos one at a time.</div>';
      return;
    }

    watches.forEach((watch, index) => {
      const row = document.createElement('div');
      row.className = 'watch';
      row.innerHTML =
        '<img src="' + watch.photo + '" alt="">' +
        '<div><div class="name">' + escapeHtml(watch.name) + '</div><div class="small">' +
        (watch.notes ? escapeHtml(watch.notes) : 'Wheel spot #' + (index + 1)) +
        '</div></div>' +
        '<button class="delete" type="button" data-index="' + index + '">X</button>';
      watchList.appendChild(row);
    });

    document.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        watches.splice(Number(btn.dataset.index), 1);
        save();
        renderList();
        drawWheel();
      });
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  photoInput.addEventListener('change', async function() {
    const file = photoInput.files && photoInput.files[0];

    if (!file) {
      selectedPhoto = null;
      previewText.textContent = 'No photo selected yet.';
      return;
    }

    previewText.textContent = 'Photo selected. Compressing...';

    try {
      selectedPhoto = await compressImage(file, 900, 0.72);
      previewText.textContent = 'Photo ready. Now hit Add Watch.';
    } catch (err) {
      selectedPhoto = null;
      previewText.textContent = 'Photo could not load. Try choosing it from Photos.';
      alert('The photo did not load. Try choosing it from Photos instead of using the camera.');
    }
  });

  addBtn.addEventListener('click', async function() {
    const name = nameInput.value.trim();
    const notes = notesInput.value.trim();

    if (!name) {
      alert('Give the watch a name first.');
      return;
    }

    let photoToSave = selectedPhoto;
    const file = photoInput.files && photoInput.files[0];

    if (!photoToSave && file) {
      previewText.textContent = 'Loading photo...';
      try {
        photoToSave = await compressImage(file, 900, 0.72);
      } catch (err) {
        alert('The photo did not load. Try choosing it from Photos instead of using the camera.');
        previewText.textContent = 'Photo could not load.';
        return;
      }
    }

    if (!photoToSave) {
      alert('Choose or take a photo first.');
      return;
    }

    watches.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      notes,
      photo: photoToSave,
      added: Date.now(),
      picked: 0
    });

    if (!save()) {
      watches.pop();
      return;
    }

    nameInput.value = '';
    notesInput.value = '';
    photoInput.value = '';
    selectedPhoto = null;
    previewText.textContent = 'Watch added. Pick another photo when ready.';
    renderList();
    drawWheel();
  });

  function pickWinnerIndex() {
    return Math.floor(Math.random() * watches.length);
  }

  function showWinner(watch) {
    result.innerHTML =
      '<strong>Today you wear:</strong>' +
      '<div style="font-size:22px;font-weight:900">' + escapeHtml(watch.name) + '</div>' +
      (watch.notes ? '<div style="color:#a3a3aa;margin-top:4px">' + escapeHtml(watch.notes) + '</div>' : '') +
      '<img src="' + watch.photo + '" alt="">';
  }

  function recordPick(index) {
    watches[index].picked = (watches[index].picked || 0) + 1;
    watches[index].lastPicked = Date.now();
    save();
    renderList();
  }

  spinBtn.addEventListener('click', function() {
    if (spinning || watches.length === 0) return;

    spinning = true;
    spinBtn.disabled = true;

    const winner = pickWinnerIndex();
    const sliceDeg = 360 / watches.length;
    const winnerCenterDeg = winner * sliceDeg + sliceDeg / 2;
    const targetDeg = 360 - winnerCenterDeg;
    const fullSpins = 6 + Math.floor(Math.random() * 4);

    rotation += fullSpins * 360 + targetDeg - (rotation % 360);
    canvas.style.transform = 'rotate(' + rotation + 'deg)';

    setTimeout(function() {
      showWinner(watches[winner]);
      recordPick(winner);
      spinning = false;
      spinBtn.disabled = false;
    }, 4600);
  });

  quickPickBtn.addEventListener('click', function() {
    if (!watches.length) return;
    const index = pickWinnerIndex();
    showWinner(watches[index]);
    recordPick(index);
  });

  clearBtn.addEventListener('click', function() {
    if (!watches.length) return;

    if (confirm('Clear all watches from this phone/browser?')) {
      watches = [];
      save();
      renderList();
      drawWheel();
      result.innerHTML = '<strong>Ready?</strong>Add your watches and spin.';
    }
  });

  exportBtn.addEventListener('click', function() {
    const backup = {
      app: 'Wrist Roulette',
      version: 1,
      exportedAt: new Date().toISOString(),
      watches
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = 'wrist-roulette-backup-' + date + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  });

  importFile.addEventListener('change', function() {
    const file = importFile.files && importFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        const imported = Array.isArray(data) ? data : data.watches;
        if (!Array.isArray(imported)) throw new Error('Bad backup');

        if (!confirm('Import backup? This will add the watches from the file to this phone.')) return;

        watches = watches.concat(imported.map(w => ({
          id: w.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
          name: w.name || 'Imported Watch',
          notes: w.notes || '',
          photo: w.photo || '',
          added: w.added || Date.now(),
          picked: w.picked || 0,
          lastPicked: w.lastPicked || null
        })).filter(w => w.photo));

        save();
        renderList();
        drawWheel();
        alert('Backup imported.');
      } catch(err) {
        alert('That backup file did not work.');
      } finally {
        importFile.value = '';
      }
    };
    reader.readAsText(file);
  });

  installHelpBtn.addEventListener('click', () => installModal.classList.remove('hidden'));
  closeInstallBtn.addEventListener('click', () => installModal.classList.add('hidden'));
  installModal.addEventListener('click', e => {
    if (e.target === installModal) installModal.classList.add('hidden');
  });

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', function() {
    setTimeout(resizeCanvas, 250);
  });

  renderList();
  resizeCanvas();
})();
