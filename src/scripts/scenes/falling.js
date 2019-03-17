/* eslint-disable no-unused-vars */
import THREE from '../three';
import * as CANNON from 'cannon';
import XrScene from './xr-scene';
import { userPosition, touchscreen } from '../controls/touch-controls';
import { controls } from '../controls/keyboard-controls';
import Table from '../../assets/Simple Wood Table.obj';

export default class FallingScene extends XrScene {
  /**
  *
  * @param {THREE.Renderer} renderer
  * @param {THREE.Camera} camera
  */
  constructor(renderer, camera) {
    super(renderer, camera);

    this.camera = camera;
    this.renderer = renderer;

    this.renderer.shadowMap.enabled = true;
    //this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.length = 64;
    this.width = 64;
    this.height = 16;
    this.createRoom();
    this.loadTable();
    this.camera = camera;
    

    // Objects 
    this.bodies = [];
    this.meshes = [];
    this.objectMaterial = new CANNON.Material();
    
    // Balls
    this.ballShape = new CANNON.Sphere(1);
    this.ballGeo = new THREE.SphereGeometry(this.ballShape.radius, 32, 32);

    // Boxes
    this.boxShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    this.boxGeo = new THREE.BoxGeometry(2, 2, 2);

    // Cylinders

    console.log("constructor");

    // this.loadTable();
    this.raycaster = new THREE.Raycaster();
    this.interactive = new THREE.Group();
    this.scene.add(this.interactive);
    this.selectedObj = null;
    this.selectedObjColor;
    this.colorSet = false;

    this.createSpawners();
    //this.ball = this.createBall();
    
    this.addLight();
    
    this.initCannon();
    this._addEventListener(window, 'mousedown', this.onClick);
    this._addEventListener(window, 'keyup', this.onKeyUp);
  }

  createRoom() {
    // Generate room geometry.
    const roomGeometry = new THREE.BoxGeometry(this.length, this.height, this.width);
    const roomMaterials = new THREE.MeshPhongMaterial({ color: 0x003050, side: THREE.BackSide });
    this.room = new THREE.Mesh(roomGeometry, roomMaterials);
    this.room.receiveShadow = true;
    this.room.castShadow = true;
    this.scene.add(this.room);
    
    // Create spawner tube
    const tubeMaterials = new THREE.MeshPhongMaterial({ color: 'gray', side: THREE.DoubleSide});
    const spawnTubeGeo = new THREE.CylinderGeometry(2, 2, 3, 32, 32, true);
    let spawnTube = new THREE.Mesh(spawnTubeGeo, tubeMaterials);
    spawnTube.position.set(0, 7, 0);
    this.scene.add(spawnTube);
  }

  createSpawners() {
    // Sphere
    let material = new THREE.MeshPhongMaterial({color: 'gray'});
    this.ballSpawner = new THREE.Mesh(this.ballGeo, material);
    this.ballSpawner.castShadow = true;
    this.ballSpawner.receiveShadow = true;
    this.ballSpawner.position.set(0, -1.6, -13);
    this.interactive.add(this.ballSpawner);

    let ballBody = new CANNON.Body({mass: 0});
    ballBody.addShape(this.ballShape);
    ballBody.position.copy(this.ballSpawner.position);
    this.world.addBody(ballBody);

    // Box
    material = new THREE.MeshPhongMaterial({color: 'gray'});
    this.boxSpawner = new THREE.Mesh(this.boxGeo, material);
    this.boxSpawner.castShadow = true;
    this.boxSpawner.receiveShadow = true;
    this.boxSpawner.position.set(-4, -1.6, -13);
    this.interactive.add(this.boxSpawner);

    let boxBody = new CANNON.Body({mass: 0});
    boxBody.addShape(this.boxShape);
    boxBody.position.copy(this.boxSpawner.position);
    this.world.addBody(boxBody);
    
    // Cylinder
  }

  // updateRay() {
  //   if (this.selectedObj) {
  //     this.selectedObj.material.color.set(this.selectedObjColor);
  //     this.colorSet = false;
  //     this.selectedObj = null;
  //   }

  //   // Get ray from keyboard controls
  //   if(controls != null) {
  //     let direction = new THREE.Vector3();
  //     controls.getDirection(direction);
  //     this.raycaster.set(controls.getObject().position, direction);
  //   }
    

  //   let intersects = this.raycaster.intersectObject(this.interactive, true);
  //   if (intersects.length > 0) {
  //     let res = intersects.filter(function(res) {
  //       return res && res.object;
  //     })[0];
      
  //     if(res && res.object) {
  //       this.selectedObj = res.object;
  //       if(!this.colorSet) {
  //         this.selectedObjColor = this.selectedObj.material.color.getHex();
          
  //         this.colorSet = true;
  //       }
  //       this.selectedObj.material.color.set('green');
  //     }
  //   }
  // }

  loadTable() {
    let object;

    function loadModel() {
      object.traverse(function(child) {
        if(child.isMesh)child.material.map = texture;
      });

      object.position.z = -15;
      object.position.y = -5.5;
      this.scene.add(object);
    }

    var manager = new THREE.LoadingManager(loadModel.bind(this));

    manager.onProgress = function(item, loaded, total) {
      console.log(item, loaded, total);
    };

    var textureLoader = new THREE.TextureLoader(manager);

    var texture = textureLoader.load('../../assets/textures/Diffuse.jpeg');

    function onProgress(xhr) {
      if (xhr.lengthComputable) {
        var percentComplete = xhr.loaded / xhr.total * 100;
        console.log('model' + Math.round(percentComplete, 2) + '% downloaded');
      }
    }

    function onError() {}

    var loader = new THREE.OBJLoader();
    loader.load(Table, function(obj) {
      object = obj;
    }, onProgress, onError);
  }

  toggleGravity = () => {
    console.log("Toggling gravity.");
    if (this.world.gravity.y === -9.8) {
      console.log("Gravity off");
      this.world.gravity.y = 0;
    } else {
      console.log("Gravity on");
      this.world.gravity.y = -9.8;
    }
  }

  reverseGravity() {
    console.log("Reverse gravity.");
    this.world.gravity.y *= -1;
  }

  onKeyUp = () => {
    switch (event.keyCode) {
      // G
      case 71:
        this.toggleGravity();
        break;
      // R
      case 82:
        this.reverseGravity();
        break;
      default:
        break;
    }
  }

  onClick = (event) => {
    if (touchscreen.enabled) {
      let touch = new THREE.Vector3();
      touch.x = (event.clientX / window.innerWidth) * 2 - 1;
      touch.y = - (event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(touch, this.camera);
    }

    this.updateRay();

    let intersects = this.raycaster.intersectObject(this.group, true);
    if (intersects.length > 0) {
      let res = intersects.filter(function(res) {
        return res && res.object;
      })[0];

      if (res && res.object) {
        if (res.object === this.ballSpawner) {
          this.spawnBall();
        } else if (res.object === this.boxSpawner) {
          this.spawnBox();
        }
      }
    }
  }

  // onClick = (event) => {
  //   if (touchscreen.enabled) {
  //     let touch = new THREE.Vector3();
  //     touch.x = (event.clientX / window.innerWidth) * 2 - 1;
  //     touch.y = - (event.clientY / window.innerHeight) * 2 + 1;

  //     this.raycaster.setFromCamera(touch, this.camera);
  //   }

  //   this.updateRay();

  //   let intersects = this.raycaster.intersectObject(this.interactive, true);
  //   if (intersects.length > 0) {
  //     let res = intersects.filter(function(res) {
  //       return res && res.object;
  //     })[0];

  //     if (res && res.object) {
  //       if (res.object === this.ballSpawner) {
  //         this.spawnBall();
  //       } else if (res.object === this.boxSpawner) {
  //         this.spawnBox();
  //       }
  //     }
  //   }
  // }

  checkObjectLimit() {
    if (this.meshes.length > 100) {
      this.world.remove(this.bodies[0]);
      this.interactive.remove(this.meshes[0]);
      this.scene.remove(this.meshes[0]);
      this.bodies.shift();
      this.meshes.shift();
    }
  }

  spawnBall() {
    console.log("Spawn ball");
    
    let ballBody = new CANNON.Body({mass: 1, material: this.objectMaterial});
    ballBody.addShape(this.ballShape);
    let material = new THREE.MeshPhongMaterial({color: 'orange'});
    let ballMesh = new THREE.Mesh(this.ballGeo, material);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    this.world.addBody(ballBody);
    this.interactive.add(ballMesh);
    
    this.bodies.push(ballBody);
    this.meshes.push(ballMesh);

    this.checkObjectLimit();
    
    ballBody.position.set(0, 7, 0);
    ballMesh.position.set(0, 7, 0);
  }

  spawnBox() {
    console.log("Spawn box");

    let boxBody = new CANNON.Body({mass: 1, material: this.objectMaterial});
    boxBody.addShape(this.boxShape);
    let material = new THREE.MeshPhongMaterial({color: 'red'});
    let boxMesh = new THREE.Mesh(this.boxGeo, material);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    this.world.addBody(boxBody);
    this.interactive.add(boxMesh);

    this.bodies.push(boxBody);
    this.meshes.push(boxMesh);

    this.checkObjectLimit();
    
    boxBody.position.set(0, 7, 0);
    boxMesh.position.set(0, 7, 0);
  }

  initCannon() {
    //const radius = 1;
    const length = this.length / 2;
    const width = this.width / 2;
    const height = this.height / 2;
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.gravity.set(0, -9.8, 0);
    
    // const sphereBody = new CANNON.Body(
    //   {
    //     mass: 1,
    //     shape: new CANNON.Sphere(radius)
    //   }
    // );
    // sphereBody.position.set(0, 1, -5);
    // this.ballBody = sphereBody;
    // this.world.add(sphereBody);

    // Creating Ground.
    const groundShape = new CANNON.Plane();
    const groundMaterial = new CANNON.Material();
    const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.set(0, -height, 0);
    this.world.addBody(groundBody);

    const groundContact = new CANNON.ContactMaterial(groundMaterial, this.objectMaterial, {friction: 0.5, restitution: 0.2});
    const objectContact = new CANNON.ContactMaterial(this.objectMaterial, this.objectMaterial, {friction: 0.4, restitution: 0.4});
    this.world.addContactMaterial(groundContact);
    this.world.addContactMaterial(objectContact);

    const roofBody = new CANNON.Body({ mass: 0 });
    roofBody.addShape(groundShape);
    roofBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    roofBody.position.set(0, height, 0);
    this.world.addBody(roofBody);

    const wallFrontBody = new CANNON.Body({mass: 0});
    wallFrontBody.addShape(groundShape);
    wallFrontBody.position.set(-length, 0, -width);
    this.world.addBody(wallFrontBody);

    const wallBackBody = new CANNON.Body({mass: 0});
    wallBackBody.addShape(groundShape);
    wallBackBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI);
    wallBackBody.position.set(length, 0, width);
    this.world.addBody(wallBackBody);

    const wallRightBody = new CANNON.Body({mass: 0});
    wallRightBody.addShape(groundShape);
    wallRightBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
    wallRightBody.position.set(length, 0, -width);
    this.world.addBody(wallRightBody);

    const wallLeftBody = new CANNON.Body({mass: 0});
    wallLeftBody.addShape(groundShape);
    wallLeftBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    wallLeftBody.position.set(-length, 0, width);
    this.world.addBody(wallLeftBody);
  }

  addLight() {
    const ambientLight = new THREE.AmbientLight('white', 0.5);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('white', 1.0, 1000);
    keyLight.position.set(-100, 0, 100);
    //keyLight.castShadow = true;
    //keyLight.shadow.bias = 0.0001;
    //keyLight.shadow.mapSize.width = 2048 * 2;
    //keyLight.shadow.mapSize.height = 2048 * 2;
    keyLight.position.set(0, 100, 0);
    keyLight.decay = 1;
    
    const fillLight = new THREE.DirectionalLight('white', 0.75, 1000);
    fillLight.position.set(100, 0, 100);

    const backLight = new THREE.DirectionalLight('white', 0.5, 1000);
    backLight.position.set(100, 0, -100).normalize();

    this.scene.add(keyLight);
    this.scene.add(fillLight);
    this.scene.add(backLight);

    const pointLight = new THREE.PointLight('white', 0.8, 500);
  
    this.scene.add(pointLight);
  }

  animate(delta) {
    this.updatePhysics(delta);

    this.updateRay();

    // Update position of meshes
    for(var i = 0; i < this.bodies.length; i++) {
      this.meshes[i].position.copy(this.bodies[i].position);
      this.meshes[i].quaternion.copy(this.bodies[i].quaternion);
    }
  }
}
