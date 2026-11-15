import Phaser from 'phaser';

export function transitionToScene(
  scene: Phaser.Scene,
  targetKey: string,
  duration = 450
): void {
  if (scene.cameras.main.fadeEffect.isRunning) return;

  scene.cameras.main.fadeOut(duration, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.start(targetKey);
  });
}

export function fadeSceneIn(scene: Phaser.Scene, duration = 450): void {
  scene.cameras.main.fadeIn(duration, 0, 0, 0);
}

