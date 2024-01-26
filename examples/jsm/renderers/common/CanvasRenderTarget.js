import { DepthTexture } from 'three';

class CanvasRenderTarget {

	constructor( parameters ) {

		this.isCanvasRenderTarget = true;

		this.context = parameters.context;
		this.domElement = parameters.domElement;
		this.alpha = ( parameters.alpha === undefined ) ? true : parameters.alpha;

		this.antialias = ( parameters.antialias === true );

		if ( this.antialias === true ) {

			this.sampleCount = ( parameters.sampleCount === undefined ) ? 4 : parameters.sampleCount;

		} else {

			this.sampleCount = 1;

		}

		this.depthTexture = new DepthTexture();

		this.depthBuffer = true;
		this.stencilBuffer = true;

		this._width = 0;
		this._height = 0;
		this._pixelRatio = 1;

	}

	getDrawingBufferSize( target ) {

		return target.set( this._width * this._pixelRatio, this._height * this._pixelRatio ).floor();

	}

	setPixelRatio( value = 1 ) {

		this._pixelRatio = value;

		this.setSize( this._width, this._height, false );

	}

	setSize( width, height, updateStyle = true ) {

		this._width = width;
		this._height = height;

		this.domElement.width = Math.floor( width * this._pixelRatio );
		this.domElement.height = Math.floor( height * this._pixelRatio );

		if ( updateStyle === true ) {

			this.domElement.style.width = width + 'px';
			this.domElement.style.height = height + 'px';

		}

	}

}

export default CanvasRenderTarget;
