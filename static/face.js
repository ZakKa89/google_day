const videoWidth = 600;
const videoHeight = 500;

const color = 'aqua';
const boundingBoxColor = 'red';
const lineWidth = 2;

let predictedAges = []

const image = new Image()

function interpolateAgePredictions(age) {
  predictedAges = [age].concat(predictedAges).slice(0, 30)
  const avgPredictedAge = predictedAges.reduce((total, a) => total + a) / predictedAges.length
  return avgPredictedAge
}

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: videoWidth,
      height: videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

function _calculateAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
}

function detectFaceInRealTime(video, net, task) {
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');

  canvas.width = videoWidth;
  canvas.height = videoHeight;
  minConfidence = 0.5
  options = new faceapi.SsdMobilenetv1Options({ minConfidence })

  async function poseDetectionFrame() {
    let minPoseConfidence;
    let minPartConfidence;

    let resultLandmarks = await faceapi.detectSingleFace(video, options).withFaceLandmarks()
    let resultExpressions = await faceapi.detectSingleFace(video, options).withFaceExpressions()

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-videoWidth, 0);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    ctx.restore();

    if (resultLandmarks && resultExpressions) {
      const canvas = $('#output').get(0)
      const dims = faceapi.matchDimensions(canvas, video, true)
      const resizedResultLandmarks = faceapi.resizeResults(resultLandmarks, dims)
      const resizedResultExpressions = faceapi.resizeResults(resultExpressions, dims)

      const minConfidence = 0.5
      const expression = maxConfidence(resizedResultExpressions.expressions)
      const leftEye = resizedResultLandmarks.landmarks.getLeftEye()
      const rightEye = resizedResultLandmarks.landmarks.getRightEye()
      const angle = _calculateAngle(leftEye[0], rightEye[0])
      console.log(angle)
      const { top, left, height, width } = resizedResultExpressions.detection.box
      image.src = `images/${expression}.png`
      // image.setAttribute('style', `transform: rotate(${angle}deg);`)
      ctx.drawImage(image, left - (height*1.2 - width)/2, top - height*0.1, height*1.2, height*1.2)

    }
    requestAnimationFrame(poseDetectionFrame);
  }
  poseDetectionFrame();
}

maxConfidence = (expressions) => {
  const target = 1
  let expressionArray = []
  Object.keys(expressions).map((key)=>{
    expressionArray.push({
      key,
      value : expressions[key]
    })
  });
  const closestTarget = expressionArray.reduce(function(prev, curr) {
    return (Math.abs(curr.value - target) < Math.abs(prev.value - target) ? curr : prev);
  });

  return closestTarget.key
}

async function start(task) {
  const net = await faceapi.nets.ssdMobilenetv1
    // const net = await faceapi.nets.tinyFaceDetector
    // const net = await faceapi.nets.mtcnn
    .load('/weights')
  await faceapi.loadFaceLandmarkModel('/weights')
  await faceapi.loadFaceExpressionModel('/weights')

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    alert('this browser does not support video capture, or this device does not have a camera');
  }

  $('#loader').removeClass('active')

  detectFaceInRealTime(video, net, task);
}


navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia || navigator.mozGetUserMedia;