import { DepthTexture } from 'three';

class CanvasRenderTarget {

	constructor( parameters ) {

		this.isCanvasRenderTarget = true;

		this.canvas = parameters.canvas;
		this.domElement = parameters.domElement;
		this.alpha = ( parameters.alpha === undefined ) ? true : parameters.alpha;

		this.antialias = ( parameters.antialias === true );

		if ( this.antialias === true ) {

			this.sampleCount = ( parameters.sampleCount === undefined ) ? 4 : parameters.sampleCount;

		} else {

			this.sampleCount = 1;

		}

		this.colorBuffer = null;
		this.depthTexture = new DepthTexture();

	}

}

export default CanvasRenderTarget;
