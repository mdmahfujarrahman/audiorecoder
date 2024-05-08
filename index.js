const startRecordingContainer = document.querySelector('.startRecordingContainer');
const recordingInfoContainer = document.querySelector('.recordingInfoContainer');
const startRecord = document.getElementById('startRecord');
const stopRecord = document.getElementById('stopRecord');
const restartRecord = document.getElementById("restart")
const durationElement = document.getElementById('durationElement');
const pauseRecord = document.getElementById('pauseRecord');
const audio = document.getElementById('audio');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyser;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const constraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 44100,
    sampleSize: 16,
    latency: 0
  }
};

let isRecording = false;
let isPauseRecord = false;
let intervalId;
let mediaRecorder;
let startTime;
let totalPausedTime = 0;
let lastPushedTime = [];
let isRestart = false

durationElement.style.display = 'none';
stopRecord.style.display = 'none';
pauseRecord.style.display = 'none';
canvas.style.display = 'none';
restartRecord.style.display= 'none'

startRecord.addEventListener('click', startRecording);
pauseRecord.addEventListener('click', togglePause);
stopRecord.addEventListener('click', stopRecording);
restartRecord.addEventListener('click', restartRecording)


async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    if(!isRestart) {
      showUIStart()
      showToast("Recording started successfully")
    }
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    visualize();
    audioCtx.resume();
    isRecording = true;
    startTime = moment();
    durationElement.style.display = 'block';
    intervalId = setInterval(updateTimer, 1000);
    if(isRestart){
      isRestart = false
    } 
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      alert('Permission denied. Please allow access to the microphone.');
    } else {
      console.error(error);
    }
  }
}



function restartRecording() {
  mediaRecorder.stop();
  resetData()
  isRestart = true
  startRecording()
  showToast("Recording restarted successfully")
}


function togglePause() {
  if (isRecording) {
    if (!isPauseRecord) {
      mediaRecorder.pause();
      isPauseRecord = true;
      totalPausedTime += moment().diff(startTime);
      lastPushedTime.push(moment().diff(startTime));
      pauseRecord.src = '/image/resume.png'
      clearInterval(intervalId);
      analyser.disconnect();
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      showToast("Recording paused successfully", 'info')
    } else {
      mediaRecorder.resume();
      startTime = moment().subtract(lastPushedTime[lastPushedTime.length - 1], 'milliseconds');
      analyser.connect(audioCtx.destination);
      isPauseRecord = false;
      pauseRecord.src = '/image/pause.png'
      intervalId = setInterval(updateTimer, 1000);
      showToast("Recording resumed successfully", 'info')
      visualize(); 
    }
  }
}

function stopRecording() {
  if (isRecording) {
    mediaRecorder.stop();
    clearInterval(intervalId);
    isRecording = false;
    mediaRecorder.ondataavailable = processData
    showToast("Recording stopped successfully, Please wait for the download to start", 'info')
  }
  
}

function processData(e) {
  const reader = new FileReader();
  const blob = new Blob([e.data], { type: 'audio/ogg; codecs=opus' });
  reader.onload = function () {
    audioContext.decodeAudioData(reader.result, function (buffer) {
      const floatSamples = buffer.getChannelData(0);
      const samples = new Int16Array(floatSamples.length);
      for (let i = 0; i < floatSamples.length; i++) {
        samples[i] = floatSamples[i] * 32767;
      }
      const mp3encoder = new lamejs.Mp3Encoder(1, 44100, 128);
      const mp3Data = [];
      const mp3buf = mp3encoder.encodeBuffer(samples);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
      const url = URL.createObjectURL(mp3Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Recording.mp3';
      document.body.appendChild(link);
      link.click();
      resetAllData();
      analyser.disconnect();
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    });
  };
  reader.readAsArrayBuffer(blob);

}

function updateTimer() {
  const duration = moment.duration(moment().diff(startTime));
  const hours = String(Math.floor(duration.asHours())).padStart(2, '0');
  const mins = String(Math.floor(duration.asMinutes()) % 60).padStart(2, '0');
  const secs = String(Math.floor(duration.asSeconds()) % 60).padStart(2, '0');
  durationElement.textContent = `${hours}:${mins}:${secs}`;
}

function visualize() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  function draw() {
    if (!isPauseRecord) {
      requestAnimationFrame(draw);
    }
    analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const lineHeight = 2;
    const lineY = canvas.height / 2;
    const barWidth = (canvas.width / bufferLength) * 2.5;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i];
      canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
      canvasCtx.fillRect(i * (barWidth + 1), lineY - barHeight, barWidth + 2, barHeight)
      canvasCtx.fillRect(i * (barWidth + 1), lineY + lineHeight / 2, barWidth + 2, barHeight);
    }
  }

  draw();
}


function resetAllData () {
  totalPausedTime = 0;
  lastPushedTime = [];
  isRecording = false;
  isPauseRecord = false;
  clearInterval(intervalId);
  mediaRecorder = null;
  startTime = null;
  durationElement.textContent = `00:00:00`;
  pauseRecord.src = '/image/pause.png'
  startRecordingContainer.style.display = 'block';
  recordingInfoContainer.style.display = 'none';
  durationElement.style.display = 'none';
  stopRecord.style.display = 'none';
  pauseRecord.style.display = 'none';
  canvas.style.display = 'none';
  restartRecord.style.display= 'none'
  analyser.disconnect();
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function resetData() {
  totalPausedTime = 0;
  lastPushedTime = [];
  isRecording = false;
  isPauseRecord = false;
  clearInterval(intervalId);
  mediaRecorder = null;
  startTime = null;
  pauseRecord.src = '/image/pause.png'
  durationElement.textContent = `00:00:00`;
  analyser.disconnect();
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function showUIStart () {
  startRecordingContainer.style.display = 'none';
  recordingInfoContainer.style.display= "flex"
  stopRecord.style.display = 'block';
  pauseRecord.style.display = 'block';
  canvas.style.display = 'block';
  restartRecord.style.display= "block"
}


function showToast (message, type = 'success') {
  Swal.fire({
    title: message,
    icon: type, // 'success', 'error', 'warning', 'info'
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000 // Duration in milliseconds
  });
}