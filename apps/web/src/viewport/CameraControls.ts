import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraControls {
  public orbControls: OrbitControls;
  private domElement: HTMLElement | null;
  private camera: THREE.PerspectiveCamera | null;
  private scene: THREE.Scene | null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private isDisposed = false;

  private isVKeyPressed = false;
  private isCtrlKeyPressed = false;
  private isShiftKeyPressed = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, scene: THREE.Scene) {
    this.orbControls = new OrbitControls(camera, domElement);
    this.domElement = domElement;
    this.camera = camera;
    this.scene = scene;

    this.orbControls.enableDamping = true;
    this.orbControls.dampingFactor = 0.05;

    // 根据设计文档：
    // 滚轮上下：放大缩小（由 enableZoom 控制，默认开启）
    // 按住中键：拖拽旋转
    // Ctrl + 中键：平移
    // Shift + 中键：缩放（DOLLY）
    // 左键点击被 V 键和选中逻辑利用，因此去掉原生左键控制
    this.orbControls.mouseButtons = {
      LEFT: null as any,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: null as any,
    };

    this.attachEvents();
  }

  private attachEvents() {
    if (!this.domElement) {
      return;
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // 使用 pointerdown 以更好支持触控和鼠标
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
  }

  private detachEvents() {
    if (!this.domElement) {
      return;
    }

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isDisposed) {
      return;
    }

    if (e.key.toLowerCase() === 'v') this.isVKeyPressed = true;
    if (e.key === 'Control') {
      this.isCtrlKeyPressed = true;
      this.orbControls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    }
    if (e.key === 'Shift') {
      this.isShiftKeyPressed = true;
      this.orbControls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.isDisposed) {
      return;
    }

    if (e.key.toLowerCase() === 'v') this.isVKeyPressed = false;
    if (e.key === 'Control') {
      this.isCtrlKeyPressed = false;
      this.restoreMidButton();
    }
    if (e.key === 'Shift') {
      this.isShiftKeyPressed = false;
      this.restoreMidButton();
    }
  };

  private restoreMidButton() {
    if (this.isShiftKeyPressed) {
      this.orbControls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    } else if (this.isCtrlKeyPressed) {
      this.orbControls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    } else {
      this.orbControls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.isDisposed) {
      return;
    }

    // V + 左键 = 重设旋转中心点
    if (e.button === 0 && this.isVKeyPressed) {
      this.setRotationCenter(e);
    }
  };

  private setRotationCenter(e: PointerEvent) {
    if (!this.domElement || !this.camera || !this.scene) {
      return;
    }

    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    // 忽略网格和坐标轴等辅助对象
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    const hit = intersects.find(
      (intersection: THREE.Intersection) =>
        !(intersection.object instanceof THREE.GridHelper) &&
        !(intersection.object instanceof THREE.AxesHelper)
    );
    
    if (hit) {
      this.orbControls.target.copy(hit.point);
      this.orbControls.update();
    }
  }

  public update(): boolean {
    if (this.isDisposed) {
      return false;
    }

    return this.orbControls.update();
  }

  public dispose() {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.detachEvents();
    this.orbControls.dispose();
    this.scene = null;
    this.camera = null;
    this.domElement = null;
    this.isVKeyPressed = false;
    this.isCtrlKeyPressed = false;
    this.isShiftKeyPressed = false;
  }
}
