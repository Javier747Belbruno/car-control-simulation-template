import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {GUI} from 'dat.gui';


var stateProgram = 1; //0 Start Screen.  //1 Free Drive. //2 PIDController.
var cameraOption = 1; //1 Chase Camera // 2 Chase Camera Side.                     

var container = <HTMLDivElement>document.querySelector('#app');


simulation();
function simulation(){


var box: THREE.Mesh;
var vehicle: CANNON.RaycastVehicle;
var w = container.clientWidth,
    h = container.clientHeight,
    scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(75, w/h, 0.001, 100),
    renderConfig = {antialias: true, alpha: true},
    renderer = new THREE.WebGLRenderer(renderConfig);

var wheelBodies: any = [],
   wheelVisuals: any = [];

var world: CANNON.World;
var chassisBody: CANNON.Body;

var initialTime: number;


  //DAT GUI
  var gui = new GUI( );

function init() {

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(w, h);
container?.appendChild(renderer.domElement);

window.addEventListener('resize', function() {
  w = container?.clientHeight;
  h = container?.clientHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
})

var geometry = new THREE.PlaneGeometry(10, 10, 10);
var material = new THREE.MeshBasicMaterial({color: 0xcc1122, side: THREE.DoubleSide});
var plane = new THREE.Mesh(geometry, material);
plane.rotation.x = Math.PI/2;
scene.add(plane);

var geometry = new THREE.PlaneGeometry(10, 10, 10);
var material = new THREE.MeshBasicMaterial({color: 0x00ff22, side: THREE.DoubleSide});
var plane = new THREE.Mesh(geometry, material);
plane.rotation.x = Math.PI/2;
plane.position.set(50,0,50);
scene.add(plane);


var sunlight = new THREE.DirectionalLight(0xffffff, 1.0);
sunlight.position.set(-10, 10, 0);
scene.add(sunlight)

/**
* Physics
**/

world = new CANNON.World();
world.broadphase = new CANNON.SAPBroadphase(world);
world.gravity.set(0, -9.81, 0);
world.defaultContactMaterial.friction = 0;

var groundMaterial = new CANNON.Material('groundMaterial');
var wheelMaterial = new CANNON.Material('wheelMaterial');
var wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
  friction: 2 ,
  restitution: 5,
  contactEquationStiffness: 1e2,
  contactEquationRelaxation: 8,
  frictionEquationStiffness: 1e2
});

world.addContactMaterial(wheelGroundContactMaterial);

// car physics body
var chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2));
chassisBody = new CANNON.Body({mass: 1600});
chassisBody.addShape(chassisShape);
chassisBody.position.set(0, 1, 0);
chassisBody.angularVelocity.set(0, 0, 0); // initial velocity

//Grid Helper
const gridHelper = new THREE.GridHelper(500, 100);
scene.add(gridHelper)

// car visual body
var geometry1 = new THREE.BoxGeometry(2, 0.6, 4); // double chasis shape
var materia1l = new THREE.MeshPhongMaterial({
  color: 0xfffff,
  emissive: 0xB1D8B7,
  side: THREE.DoubleSide,
  flatShading: true,
});
//var materia1l = new THREE.MeshStandardMaterial({  });
box = new THREE.Mesh(geometry1, materia1l);
scene.add(box);

// parent vehicle object
vehicle = new CANNON.RaycastVehicle({
  chassisBody: chassisBody,
  indexRightAxis: 0, // x
  indexUpAxis: 1, // y
  indexForwardAxis: 2, // z
});

// wheel options
var options = {
  radius: 0.4,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 50,
  suspensionRestLength: 0.75,
  frictionSlip: 2.5,
  dampingRelaxation: 2.3,
  dampingCompression: 4.5,
  maxSuspensionForce: 200000,
  rollInfluence:  0.01,
  axleLocal: new CANNON.Vec3(-1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
  maxSuspensionTravel: 0.3,
  customSlidingRotationalSpeed: -1,
  useCustomSlidingRotationalSpeed: true,
};

var axlewidth = 0.75;
options.chassisConnectionPointLocal.set(axlewidth, 0, -1);
vehicle.addWheel(options);

options.chassisConnectionPointLocal.set(-axlewidth, 0, -1);
vehicle.addWheel(options);

options.chassisConnectionPointLocal.set(axlewidth, 0, 1);
vehicle.addWheel(options);

options.chassisConnectionPointLocal.set(-axlewidth, 0, 1);
vehicle.addWheel(options);

vehicle.addToWorld(world);

// car wheels

vehicle.wheelInfos.forEach(function(wheel: any) {
  var shape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 35);
  var body = new CANNON.Body({mass: 8, material: wheelMaterial});
  var q = new CANNON.Quaternion();
  q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
  body.addShape(shape, new CANNON.Vec3(), q);
  wheelBodies.push(body);
  // wheel visual body
  var geometry = new THREE.CylinderGeometry( wheel.radius, wheel.radius, 0.5, 4 );
  var material = new THREE.MeshPhongMaterial({
    color: 0xd0901d,
    emissive: 0x1101aa,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  var cylinder = new THREE.Mesh(geometry, material);
  cylinder.geometry.rotateZ(Math.PI/2);
  wheelVisuals.push(cylinder);
  scene.add(cylinder);
});

// update the wheels to match the physics
world.addEventListener('postStep', function() {
  for (var i=0; i<vehicle.wheelInfos.length; i++) {
    vehicle.updateWheelTransform(i);
    var t = vehicle.wheelInfos[i].worldTransform;
    // update wheel physics
    wheelBodies[i].position.copy(t.position);
    wheelBodies[i].quaternion.copy(t.quaternion);
    // update wheel visuals
    wheelVisuals[i].position.copy(t.position);
    wheelVisuals[i].quaternion.copy(t.quaternion);
  }
});

var q = plane.quaternion;
var planeBody = new CANNON.Body({
  mass: 0, // mass = 0 makes the body static
  material: groundMaterial,
  shape: new CANNON.Plane(),
  quaternion: new CANNON.Quaternion(-q.x, q.y, q.z, q.w)
});
world.addBody(planeBody);

}

init();

var point = new CANNON.Vec3(100,0,100 ); // Objetive.

const constantsControl = {
  //Kp = Proptional Constant.
  Kp: 480,
//Kd = Derivative Constant.
  Kd: 900,
  //Ki = Integral Constant.
  Ki: 0
};
if(stateProgram==2){
const constFolder = gui.addFolder("Control Constants");
constFolder.add(constantsControl, "Kp", -200, 2000, 10)
constFolder.add(constantsControl, "Ki", -200, 2000, 10)
constFolder.add(constantsControl, "Kd", -200, 2000, 10)
constFolder.open();};

var P , I , D = 0;

var ek_1 = 0; 
var dt = 1/60;
var int = 0;
var u = 0;

function PID_Controller(){
  var ref = chassisBody.position.length();
  var pointLength = point.length();
  console.log(pointLength);
  //err = Expected Output - Actual Output;
  var e = ref - pointLength;
  
  //Proptional action
  P = constantsControl.Kp * e;
  //Differential action
  D = constantsControl.Kd * (e - ek_1) / dt; 
  //Integral action
   I = constantsControl.Ki * int * dt;
  // u = Kp * err + (Ki * int * dt) + (Kd * der /dt) //Action
   u = P + I + D; //I
  
  EngineForceVal(u);
  
  //der  = err - err from previous loop; ( i.e. differential error)
  ek_1 = e;
  //int  = int from previous loop + err; ( i.e. integral error )
  int = int + e;
}


const carConst = {
  //Motor Force Limit.
  engineForceLimit: 3000,
  //Angle Steering.
  SteeringValLimit: 0.3,
  //Brake Force.
  brakeForceLimit: 200
};
const phyFolder = gui.addFolder("Car Constants");
phyFolder.add(carConst, "engineForceLimit", 0, 10000, 10);
phyFolder.add(carConst, "SteeringValLimit", 0, 1, 0.01);
phyFolder.add(carConst, "brakeForceLimit", 0, 1000, 10);
phyFolder.open();

function EngineForceVal(value: any){
  //Limit Signal
  if(value > carConst.engineForceLimit){
    value = carConst.engineForceLimit; 
  }
  if(value < -carConst.engineForceLimit){
    value = -carConst.engineForceLimit; 
  }
  for (let index = 0; index < 4; index++) {
    vehicle.applyEngineForce(value, index); 
  }
}

function BrakeValApplied(value: any){
  for (let index = 0; index < 2; index++) {
    vehicle.setBrake(value, index); 
  }
}
function SteeringVal(value: any){
  vehicle.setSteeringValue(value, 2);
  vehicle.setSteeringValue(value, 3);
}

function forward(){
  EngineForceVal(-carConst.engineForceLimit);
}
function backward(){
  EngineForceVal(carConst.engineForceLimit);
}
function NotEngineForce(){
  EngineForceVal(0);
}

function brake(){
  BrakeValApplied(carConst.brakeForceLimit);
}
function unbrake(){
  BrakeValApplied(0);
}

function right(){
  SteeringVal(-carConst.SteeringValLimit);
}

function left(){
  SteeringVal(carConst.SteeringValLimit);
}

function releaseSteering(){
  SteeringVal(0);
}

function chaseCameraSide(){
  var cameraOffset;
  var relativeCameraOffset;
  relativeCameraOffset = new THREE.Vector3(-10,4,-18);
  cameraOffset = relativeCameraOffset.applyMatrix4(box.matrixWorld);
  camera.position.x = cameraOffset.x  ;
  camera.position.y = cameraOffset.y ;
  camera.position.z = cameraOffset.z ;
  camera.lookAt(new THREE.Vector3(vehicle.chassisBody.position.x,vehicle.chassisBody.position.y,vehicle.chassisBody.position.z));
}

function chaseCamera(){
  var cameraOffset;
  var relativeCameraOffset;
  relativeCameraOffset = new THREE.Vector3(0,4,-6);
  cameraOffset = relativeCameraOffset.applyMatrix4(box.matrixWorld);
  camera.position.x = cameraOffset.x  ;
  camera.position.y = cameraOffset.y ;
  camera.position.z = cameraOffset.z ;
  camera.lookAt(new THREE.Vector3(vehicle.chassisBody.position.x,vehicle.chassisBody.position.y,vehicle.chassisBody.position.z));
}

let controller = new Map();

controller.set(87,{pressed: false, funcPress: forward , funcUnPress: NotEngineForce});
controller.set(32,{pressed: false, funcPress: brake, funcUnPress: unbrake});
controller.set(83,{pressed: false, funcPress: backward, funcUnPress: NotEngineForce});
controller.set(68,{pressed: false, funcPress: right, funcUnPress: releaseSteering});
controller.set(65,{pressed: false, funcPress: left, funcUnPress: releaseSteering});

function navigate(e: any){
    if(e.type == 'keydown'){
      if(controller.get(e.keyCode)){
      controller.set(e.keyCode,{pressed: true,funcPress: controller.get(e.keyCode).funcPress , funcUnPress: controller.get(e.keyCode).funcUnPress });
      }
      changeCamera(e.keyCode);
    }
    if(e.type == 'keyup'){
      if(controller.get(e.keyCode)){
        controller.set(e.keyCode,{pressed: false,funcPress: controller.get(e.keyCode).funcPress , funcUnPress: controller.get(e.keyCode).funcUnPress });
      }
    }
}

//Window Event Listener (Triggers)
window.addEventListener('keydown', navigate);
window.addEventListener('keyup', navigate);

function executeMoves(){
  for (let [key, value] of controller) {
    if(value.pressed){
      value.funcPress();
    }else{
      //fix here  
      if(key==32 || key==68 || key==87 ){
      value.funcUnPress();
      }
    }
  }
}

function updatePhysics() {
  world.step(1/40);
  // update the chassis position
  box.position.copy(new THREE.Vector3( chassisBody.position.x,chassisBody.position.y,chassisBody.position.z));
  box.quaternion.copy(new THREE.Quaternion(chassisBody.quaternion.x,chassisBody.quaternion.y,chassisBody.quaternion.z,chassisBody.quaternion.w));
}

function changeCamera(camNumb: Number){
  switch (camNumb) {
    case 49:
      cameraOption = 1;
      break;
    case 50:
      cameraOption = 2;
    default:
      break;
  }
}

function Camera(){
  switch (cameraOption) {
    case 1:
      chaseCamera();
      break;
    case 2:
      chaseCameraSide();
    default:
      break;
  }
}

var winnerInfo = '';
function UpdateInfo(){
  var vec = new CANNON.Vec3;
  var q1= vehicle.wheelInfos[0].axleWorld.x;

  var q3= vehicle.wheelInfos[0].axleWorld.z;
  var roll  = Math.atan2(2.0 * (q3 ) , 1.0 - 2.0 * (q1 * q1 ));
  var pitch = Math.asin(2.0 * ( q3 * q1));
  var yaw   = Math.atan2(2.0 * (q3  + q1 ) , - 1.0 + 2.0 * ( q1 * q1));

  CurrentTime = String((Date.now() - initialTime)/1000);
}

var winningTime="timeless";
function DidYouWin(){
  if(winningTime=="timeless"){
    if(Math.round(vehicle.chassisBody.velocity.length())==0 && Math.round(vehicle.chassisBody.position.length())==point.length() ){
      winningTime = CurrentTime;
      winnerInfo = "\n" + "Winning Time (Seconds): " +  winningTime;
      window.alert(winnerInfo);
    }
  }
}

function render() {
  requestAnimationFrame(render);
  executeMoves();
  if(stateProgram==2){PID_Controller();}
  Camera();
  renderer.render(scene, camera);
  updatePhysics();
  UpdateInfo();
  DidYouWin();
}

initialTime = Date.now();
var CurrentTime: string;

if(stateProgram==2){
  setTimeout(() => {
    render();
  }, 2000);
}else{
  render();
}




}

