import { Vector3, Quaternion, Matrix4 } from 'three';
import { canvas } from './renderer/canvas';
import { cameraSettings } from './renderer/camera';
import { renderer } from './renderer';
import { addMouseKeyboardEventListeners } from './controls/keyboard-controls';
import { showTouchControls } from './controls/touch-controls';
import { setupInteractions, closeInteractions } from './interactions';

/**
 * XR fields we are using
 * Explained here : { https://github.com/immersive-web/webxr-reference/tree/master/webxr-device-api }
 * and here {https://immersive-web.github.io/webxr-reference/}
 */

export const XR = {
  session: null,
  refSpace: null,
  magicWindowCanvas: null,
  mirrorCanvas: null,
  getOffsetMatrix() {
    if (this.refSpace) {
      return new Matrix4().fromArray(this.refSpace.originOffset.matrix);
    }
    return new Matrix4();
  },
  setOffsetMatrix(matrix) {
    const position = new Vector3();
    const scale = new Vector3();
    const rotation = new Quaternion();
    matrix.decompose(position, rotation, scale);
    /* global XRRigidTransform */
    this.refSpace.originOffset = new XRRigidTransform(
      new DOMPoint(position.x, position.y, position.z, 1),
      new DOMPoint(rotation.x, rotation.y, rotation.z, rotation.w)
    );
  }
};

/*
* Creates a button that renders each eye for VR
*/
function createVRButton() {
  const vrButton = document.createElement('button');
  vrButton.classList.add('vr-toggle');
  vrButton.id = 'vr-toggle';
  vrButton.textContent = 'Enter VR';
  vrButton.addEventListener('click', () => {
    if (XR.session) {
      XR.session.end();
    }
    xrOnRequestSession();
  });
  document.body.appendChild(vrButton);
}

function xrOnSessionEnded(event) {
  closeInteractions(event.session);
  if (event.session === XR.session) XR.session = null;

  if (event.session.renderState.outputContext) {
    // Not sure why it wasn't on the body element, but this should remove it no matter where it is.
    event.session.renderState.outputContext.canvas.remove();
  }

  // Reset xrState when session ends and remove the mirror canvas
  if (event.session.mode === 'immersive-vr') {
    // TODO: Need to change this to xrValidate() to handle cases where device cannot support
    // magic window on exit of immersive session
    xrValidateMagicWindow();
  }
}

async function xrOnSessionStarted(context) {
  // I'm seeing xrOnSessionEnded being called twice.  I'm going to see if using once fixes this / causes other problems.
  XR.session.addEventListener('end', xrOnSessionEnded, {
    once: true
  });

  setupInteractions();

  // Set rendering canvas to be XR compatible and add a baselayer
  try {
    await renderer.context.makeXRCompatible();
  } catch (err) {
    console.error(`Error making rendering context XR compatible : ${err}`);
  }

  /* global XRWebGLLayer:true */
  XR.session.updateRenderState({
    baseLayer: new XRWebGLLayer(XR.session, renderer.context),
    outputContext: context
  });

  try {
    // preserve originOffset
    const originOffset = XR.getOffsetMatrix();
    XR.refSpace = await XR.session.requestReferenceSpace({
      type: 'stationary',
      subtype: 'eye-level'
    });
    XR.setOffsetMatrix(originOffset);

    // Fire a restart xr animation event
    window.dispatchEvent(new Event('xrAnimate'));
  } catch (err) {
    console.error(`Error requesting reference space : ${err}`);
  }
}

/**
 * Gets an immersive two eye view xr session when the 'ENTER XR' button has been pressed
 */
async function xrOnRequestSession() {
  // Create a mirror canvas for rendering the second eye
  const xrMirrorCanvas = document.createElement('canvas');
  const xrMirrorContext = xrMirrorCanvas.getContext('xrpresent');
  xrMirrorCanvas.setAttribute('id', 'mirror-canvas');

  // Add the mirror canvas to our XR object and the document.
  XR.mirrorCanvas = xrMirrorCanvas;

  // Attempt to create an XR session using the mirror canvas and the connected device
  try {
    XR.session = await navigator.xr.requestSession('immersive-vr');
    document.body.appendChild(xrMirrorCanvas);
    xrOnSessionStarted(xrMirrorContext);
  } catch (err) {
    xrValidateMagicWindow();
    console.error(`Error initializing XR session : ${err}`);
  }
}

/**
 * Checks for magic window compatibility
 */
async function xrValidateMagicWindow() {
  XR.magicWindowCanvas = document.createElement('canvas');
  XR.magicWindowCanvas.setAttribute('id', 'vr-port');
  XR.magicWindowCanvas.setAttribute('name', 'magic-window');

  XR.magicWindowCanvas.width = window.innerWidth;
  XR.magicWindowCanvas.height = window.innerHeight;

  // Set canvas rendering context to xrpresent
  const xrMagicWindowContext = XR.magicWindowCanvas.getContext('xrpresent');

  try {
    XR.session = await navigator.xr.requestSession('inline');
    canvas.style.display = 'none';
    canvas.parentNode.insertBefore(XR.magicWindowCanvas, canvas);
    xrOnSessionStarted(xrMagicWindowContext);
  } catch (reason) {
    console.log(`Device unable to support magic window session : ${reason}`);
  }
}

/*
 * Waits for an XR device to connect to the session and validates its capabilities
 */
async function xrValidate() {
  // TODO: Create new VRButton object here

  // Check that the browser has XR enabled
  if (navigator.xr) {
    // Listens for when a device changes and calls this function once again
    // to validate the new device / setup XR sessions
    navigator.xr.addEventListener('device-change', xrValidate);

    // Check if device is capable of an immersive-vr sessions
    try {
      await navigator.xr.supportsSession('immersive-vr');
      createVRButton();
    } catch (reason) {
      console.log(`Device unable to support immersive-vr session : ${reason || ''}`);
    }

    // Check to see if an non-immersive xr session is supported
    try {
      await navigator.xr.supportsSession('inline');
      showTouchControls();
      xrValidateMagicWindow();
    } catch (reason) {
      console.log(`Device unable to support inline session : ${reason || ''}`);
      console.log('Instead, enable keyboard/mouse.');
      addMouseKeyboardEventListeners();
    }
  } else {
    addMouseKeyboardEventListeners();
  }
}

xrValidate();
