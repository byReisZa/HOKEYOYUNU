import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth/window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  antialias:true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

document.body.appendChild(renderer.domElement);





// IŞIK

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(10,20,10);
light.castShadow = true;
scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff,0.5));






// ZEMİN

const groundGeo = new THREE.PlaneGeometry(500,500);
const groundMat = new THREE.MeshStandardMaterial({
  color:0x2f7d32
});

const ground = new THREE.Mesh(groundGeo,groundMat);

ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;

scene.add(ground);







// YOL

const roadGeo = new THREE.PlaneGeometry(20,500);

const roadMat = new THREE.MeshStandardMaterial({
  color:0x222222
});

const road = new THREE.Mesh(roadGeo,roadMat);

road.rotation.x = -Math.PI/2;
road.position.y = 0.01;

scene.add(road);








// ARABA

const car = new THREE.Group();



// Gövde
const body = new THREE.Mesh(
  new THREE.BoxGeometry(3,1,5),
  new THREE.MeshStandardMaterial({
    color:0xff0000
  })
);

body.position.y = 1.2;
body.castShadow = true;

car.add(body);




// Üst
const topCar = new THREE.Mesh(
  new THREE.BoxGeometry(2.5,1,2.5),
  new THREE.MeshStandardMaterial({
    color:0xaa0000
  })
);

topCar.position.y = 2;
topCar.position.z = -0.2;
topCar.castShadow = true;

car.add(topCar);






// TEKERLER

function wheel(x,z){

  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5,0.5,0.7,32),
    new THREE.MeshStandardMaterial({
      color:0x111111
    })
  );

  wheel.rotation.z = Math.PI/2;

  wheel.position.set(x,0.5,z);

  wheel.castShadow = true;

  car.add(wheel);

  return wheel;
}

const wheel1 = wheel(-1.5,  1.8);
const wheel2 = wheel( 1.5,  1.8);
const wheel3 = wheel(-1.5, -1.8);
const wheel4 = wheel( 1.5, -1.8);

scene.add(car);






// KONTROLLER

const keys = {};

window.addEventListener('keydown',(e)=>{
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup',(e)=>{
  keys[e.key.toLowerCase()] = false;
});






let speed = 0;
let maxSpeed = 2;
let acceleration = 0.02;
let friction = 0.01;
let turnSpeed = 0.03;






// YOL ÇİZGİLERİ

for(let i=0;i<100;i++){

  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.3,0.02,4),
    new THREE.MeshBasicMaterial({
      color:0xffffff
    })
  );

  line.position.z = i * -10;
  line.position.y = 0.02;

  scene.add(line);
}







// KAMERA

camera.position.set(0,5,10);






// ANİMASYON

function animate(){

  requestAnimationFrame(animate);




  // İLERİ
  if(keys['w']){

    speed += acceleration;

    if(speed > maxSpeed)
      speed = maxSpeed;
  }






  // GERİ
  if(keys['s']){

    speed -= acceleration;

    if(speed < -1)
      speed = -1;
  }






  // FREN
  if(!keys['w'] && !keys['s']){

    if(speed > 0){
      speed -= friction;
    }

    if(speed < 0){
      speed += friction;
    }

    if(Math.abs(speed) < 0.01){
      speed = 0;
    }
  }






  // DÖNÜŞ

  if(keys['a']){

    car.rotation.y -= turnSpeed * (speed * 0.5);
  }

  if(keys['d']){

    car.rotation.y += turnSpeed * (speed * 0.5);
  }






  // HAREKET

  car.position.x += Math.sin(car.rotation.y) * speed;

  car.position.z += Math.cos(car.rotation.y) * speed;







  // TEKER DÖNÜŞÜ

  wheel1.rotation.x += speed;
  wheel2.rotation.x += speed;
  wheel3.rotation.x += speed;
  wheel4.rotation.x += speed;







  // KAMERA TAKİP

  const camX = car.position.x - Math.sin(car.rotation.y) * 10;

  const camZ = car.position.z - Math.cos(car.rotation.y) * 10;

  camera.position.x += (camX - camera.position.x) * 0.05;

  camera.position.z += (camZ - camera.position.z) * 0.05;

  camera.lookAt(car.position);







  // HIZ GÖSTERGESİ

  document.getElementById('speed').innerText =
    Math.abs(Math.floor(speed * 100)) + ' KM/H';







  renderer.render(scene,camera);
}

animate();






// EKRAN BOYUTU

window.addEventListener('resize',()=>{

  camera.aspect = window.innerWidth/window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth,window.innerHeight);

});
