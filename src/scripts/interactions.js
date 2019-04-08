import {
  Raycaster,
  Vector3, Matrix4, Quaternion
} from 'three';
import { getCurrentScene } from './currentScene';
import { XR } from './xrController';
import { camera } from './renderer/camera';

// TODO: Split Interactions into indevidual interfaces:
// - HoverInteraction
// - DragInteraction
// - SelectInteraction
// Make different symbols for each so that instead of checking if an object has
// interactions and then checking if it has the specific function, then we could
// just check for the one symbol.

// Put Interaction Callbacks under a special symbol
// so that we don't get confused with things on the three Object
export const Interactions = Symbol('Symbol Interactions');

let inputSources = [];
const handleInputSourcesChange = ({ session }) => {
  inputSources = session.getInputSources();
  console.log('Input Sources Changed.');
};

function createRay(inputSource, xrFrame) {
  if (inputSource.targetRaySpace) {
    const rayPose = xrFrame.getPose(inputSource.targetRaySpace, XR.refSpace);

    if (rayPose) {
      /* global XRRay:true */
      return new XRRay(rayPose.transform);
    }
  }
  return null;
}

function handlerCommon(func) {
  return function ({ frame, inputSource }) {
    const ray = createRay(inputSource, frame);
    if (ray) {
      for (const intersection of raycast(ray)) {
        func(intersection, inputSource, new Matrix4().fromArray(ray.matrix));
        break;
      }
    }
  };
}
// Each input source can only be dragging one thing at a time, so:
// dragAndDrop is a map from inputSource -> {offset}
const dragAndDrop = new Map();
const handleSelectStart = handlerCommon((intersection, inputSource, pointerMatrix) => {
  const interactions = intersection.object[Interactions];
  if (interactions) {
    if (interactions.drag_start || interactions.drag_end || interactions.drag) {
      // TODO: Apply rotation
      let data;
      if (interactions.drag_start) {
        data = interactions.drag_start(intersection, pointerMatrix);
      } else {
        const pointerInverse = new Matrix4().getInverse(pointerMatrix, true);
        const target = new Matrix4().copy(intersection.object.matrixWorld);
        const transformMatrix = new Matrix4().multiplyMatrices(pointerInverse, target);
        data = {
          object: intersection.object,
          transformMatrix,
          matrixAutoUpdate: intersection.object.matrixAutoUpdate
        };
      }
      intersection.object.matrixAutoUpdate = false;
      dragAndDrop.set(inputSource, data);
    } else if (interactions.select_start) {
      interactions.select_start(intersection);
    }
  }
});
const handleSelectEnd = handlerCommon((intersection, inputSource) => {
  // Handle the end of dragging
  const data = dragAndDrop.get(inputSource);
  if (data) {
    const dragend = data.object[Interactions].drag_end;
    data.object.matrixAutoUpdate = data.matrixAutoUpdate;
    dragAndDrop.delete(inputSource);
    if (dragend) {
      dragend();
    }
  }

  const interactions = intersection.object[Interactions];
  if (interactions) {
    // Handle the end of selection
    if (interactions.select_end) {
      interactions.select_end(intersection);
    }
  }
});
const handleSelect = handlerCommon((intersection) => {
  const interactions = intersection.object[Interactions];
  if (interactions) {
    if (interactions.select) {
      interactions.select(intersection);
    }
  }
});

export function setupInteractions() {
  inputSources = XR.session.getInputSources();
  console.log(inputSources);
  XR.session.addEventListener('inputsourceschange', handleInputSourcesChange);

  XR.session.addEventListener('select', handleSelect);
  XR.session.addEventListener('selectstart', handleSelectStart);
  XR.session.addEventListener('selectend', handleSelectEnd);
}

const raycaster = new Raycaster();
function raycast(xrRay) {
  const { scene } = getCurrentScene();

  const trMatrix = new Matrix4().fromArray(xrRay.matrix);

  // Transformed ray matrix from the current scene matrix world
  const rMatrix = new Matrix4().multiplyMatrices(scene.matrixWorld, trMatrix);

  raycaster.set(
    new Vector3().setFromMatrixPosition(rMatrix),
    new Vector3(0, 0, -1).transformDirection(rMatrix)
      .normalize()
  );
  const intersections = raycaster.intersectObjects(scene.children, true);
  for (const intersection of intersections) {
    intersection.point.applyMatrix4(scene.matrixWorld);
  }
  return intersections;
}

const lastObjects = new Map();
function updateInputSource(inputSource, ray) {
  // Handle Drag and Drop
  if (dragAndDrop.has(inputSource)) {
    const { object, transformMatrix } = dragAndDrop.get(inputSource);
    const newMatrix = new Matrix4().multiplyMatrices(new Matrix4().fromArray(ray.matrix), transformMatrix);
    if (object[Interactions].drag) {
      object[Interactions].drag(newMatrix);
    } else {
      object.matrix = newMatrix;
      object.updateMatrixWorld(true);
    }
  }

  for (const intersection of raycast(ray)) {
    const lastObject = lastObjects.get(inputSource);
    if (intersection) {
      if (lastObject !== intersection.object) {
        if (lastObject && lastObject[Interactions] && lastObject[Interactions].hover_end) {
          lastObject[Interactions].hover_end();
        }
        if (intersection.object[Interactions] && intersection.object[Interactions].hover_start) {
          intersection.object[Interactions].hover_start(intersection);
        }
        lastObjects.set(inputSource, intersection.object);
      }
      if (intersection.object[Interactions] && intersection.object[Interactions].hover) {
        intersection.object[Interactions].hover(intersection);
      }
      break; // MAYBE: Handle more than the closest object?
    } else {
      if (lastObject) {
        if (lastObject[Interactions] && lastObject[Interactions].hover_end) {
          lastObject[Interactions].hover_end();
        }
        lastObjects.delete(inputSource);
      }
    }
  }
}
const psuedoInputSource = Symbol('Psydo InputSource')
export function handleInteractions(timestamp, frame) {
  if (frame) {
    if (inputSources.length > 0) {
      for (const inputSource of inputSources) {
        const ray = createRay(inputSource, frame);
        updateInputSource(inputSource, ray);
      }
    } else {
      // Psuedo input source for hover using magic window (mostly);
      // This projects a ray from the last rendered eye
      const cameraPosition = new Vector3();
      const cameraOrientation = new Quaternion()
      camera.matrixWorld.decompose(cameraPosition, cameraOrientation, new Vector3());
      const pseudoRay = new XRRay(new XRRigidTransform(
        new DOMPoint(cameraPosition.x, cameraPosition.y, cameraPosition.z, 1),
        new DOMPoint(cameraOrientation.x, cameraOrientation.y, cameraOrientation.z, cameraOrientation.w)
        ));
      updateInputSource(psuedoInputSource, pseudoRay);
    }
  }
}


export function closeInteractions(session) {
  for (const [inputSource, lastObject] of lastObjects.entries()) {
    if (lastObject) {
      if (lastObject[Interactions] && lastObject[Interactions].hover_end) {
        lastObject[Interactions].hover_end();
      }
      lastObjects.delete(inputSource);
    }
  }
  session.removeEventListener('inputsourceschange', handleInputSourcesChange);

  session.removeEventListener('select', handleSelect);
  session.removeEventListener('selectstart', handleSelectStart);
  session.removeEventListener('selectend', handleSelectEnd);
}