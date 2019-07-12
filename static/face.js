const videoWidth = 600;
const videoHeight = 500;

const color = 'aqua';
const boundingBoxColor = 'red';
const lineWidth = 2;

let predictedAges = []

const bombImage = new Image()
bombImage.src = 'images/bomb.png'
let bombYPos = -80
let bombXPos = (videoWidth - 40) * Math.random()
let prashantId
let timeoutId

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

function drawBombFalling() {
  if (bombYPos > videoHeight) {
    bombYPos = -80
    bombXPos = (videoWidth - 40) * Math.random()
  } else {
    bombYPos += 1
  }
}

function shapesColliding(r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h) {

 // are the sides of one rectangle touching the other?

 if (r1x + r1w >= r2x &&    // r1 right edge past r2 left
     r1x <= r2x + r2w &&    // r1 left edge past r2 right
     r1y + r1h >= r2y &&    // r1 top edge past r2 bottom
     r1y <= r2y + r2h) {    // r1 bottom edge past r2 top
       return true;
 }
 return false;
}

function detectFaceInRealTime(video, net, task) {
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');

  canvas.width = videoWidth;
  canvas.height = videoHeight;
  minConfidence = 0.5
  options = new faceapi.SsdMobilenetv1Options({ minConfidence })

  setInterval(drawBombFalling, 10)

  async function poseDetectionFrame() {
    let minPoseConfidence;
    let minPartConfidence;

    // let resultLandmarks = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceExpressions()
    let resultExpressions = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceExpressions()
    // console.log('resultExpressions : ',resultExpressions)
    // console.log('resultLandmark : ',resultLandmarks)

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-videoWidth, 0);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    ctx.restore();

    if (resultExpressions.length > 0) {
      const canvas = $('#output').get(0)
      const dims = faceapi.matchDimensions(canvas, video, true)
      const resizedResultExpressions = faceapi.resizeResults(resultExpressions, dims)
      for(let i = 0;i<resizedResultExpressions.length;i++){
        const minConfidence = 0.5
        const expression = maxConfidence(resizedResultExpressions[i].expressions)       
        if(resizedResultExpressions.length > 0 &&  resizedResultExpressions[i].landmarks){
          const leftEye = resizedResultExpressions[i].landmarks.getLeftEye()
          const rightEye = resizedResultExpressions[i].landmarks.getRightEye()
          const angle = _calculateAngle(leftEye[0], rightEye[0])
          // console.log(angle)
          const { top, left, height, width } = resizedResultExpressions[i].detection.box
          const image = new Image()
          if (prashantId !== i) {
            image.src = `images/${expression}.png`
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
          } else {
            image.src = `images/prashant.png`
          }
          const x = left + width/2
          const y = top + height/2
          ctx.save()
          ctx.translate(x,y)
          ctx.rotate(angle * Math.PI/180)
          ctx.translate(-x,-y)
          ctx.drawImage(image, left - (height*1.2 - width)/2, top - height*0.1, height*1.2, height*1.2)
          ctx.restore()

          ctx.drawImage(bombImage, bombXPos, bombYPos, 80, 80)

          if (shapesColliding(
            left - (height*1.2 - width)/2, top - height*0.1, height*1.2, height*1.2,
            bombXPos, bombYPos, 80, 80
          )) {
            bombYPos = -400
            prashantId = i
            const audio = new Audio('images/explosion.wav')
            audio.play()
            timeoutId = setTimeout(() => {
              prashantId = null
            }, 1500)
          }
       }
        
      }
      
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