import { Matrix3 } from '../../math/Matrix3.js';
import { Plane } from '../../math/Plane.js';
import { Vector4 } from '../../math/Vector4.js';

const _plane = /*@__PURE__*/ new Plane();

let _clippingContextVersion = 0;

class ClippingContext {

	constructor() {

		this.version = ++ _clippingContextVersion;

		this.clipIntersection = null;

		this.intersectionPlanes = [];
		this.unionPlanes = [];

		this.parentVersion = 0;
		this.viewNormalMatrix = new Matrix3();
		this.clippingGroupContexts = new WeakMap();
		this.shadowPass = false;
		this.inherit = null;

	}

	projectPlanes( source, destination, offset ) {

		const l = source.length;

		for ( let i = 0; i < l; i ++ ) {

			_plane.copy( source[ i ] ).applyMatrix4( this.viewMatrix, this.viewNormalMatrix );

			const v = destination[ offset + i ];
			const normal = _plane.normal;

			v.x = - normal.x;
			v.y = - normal.y;
			v.z = - normal.z;
			v.w = _plane.constant;

		}

	}

	updateGlobal( scene, camera ) {

		this.shadowPass = ( scene.overrideMaterial !== null && scene.overrideMaterial.isShadowNodeMaterial );
		this.viewMatrix = camera.matrixWorldInverse;

		this.viewNormalMatrix.getNormalMatrix( this.viewMatrix );

	}

	update( parentContext, clippingGroup ) {

		let update = false;
		let parentChanged = false;

		if ( parentContext.version !== this.parentVersion ) {

			this.parentVersion = parentContext.version;
			this.viewMatrix = parentContext.viewMatrix;
			this.viewNormalMatrix = parentContext.viewNormalMatrix;
			this.shadowPass = parentContext.shadowPass;

			parentChanged = true;

		}

		if ( this.inherit !== clippingGroup.inherit || parentChanged ) {

			this.inherit = clippingGroup.inherit;

			if ( this.inherit ) {

				this.intersectionPlanes = Array.from( parentContext.intersectionPlanes );
				this.unionPlanes = Array.from( parentContext.unionPlanes );


			} else {

				this.intersectionPlanes = [];
				this.unionPlanes = [];

			}

		}

		if ( this.clipIntersection !== clippingGroup.clipIntersection || parentChanged ) {

			this.clipIntersection = clippingGroup.clipIntersection;

			if ( this.clipIntersection ) {

				this.unionPlanes.length = this.inherit ? parentContext.unionPlanes.length : 0;

			} else {

				this.intersectionPlanes.length = this.inherit ? parentContext.intersectionPlanes.length : 0;

			}

		}

		const srcClippingPlanes = clippingGroup.clippingPlanes;
		const l = srcClippingPlanes.length;

		let dstClippingPlanes;
		let offset;

		if ( this.clipIntersection ) {

			dstClippingPlanes = this.intersectionPlanes;
			offset = this.inherit ? parentContext.intersectionPlanes.length : 0;;

		} else {

			dstClippingPlanes = this.unionPlanes;
			offset = this.inherit ? parentContext.unionPlanes.length : 0;

		}

		if ( dstClippingPlanes.length !== offset + l ) {

			dstClippingPlanes.length = offset + l;

			for ( let i = 0; i < l; i ++ ) {

				dstClippingPlanes[ offset + i ] = new Vector4();

			}

			update = true;

		}

		this.projectPlanes( srcClippingPlanes, dstClippingPlanes, offset );

		if ( update ) this.version = _clippingContextVersion ++;

	}

	getGroupContext( clippingGroup ) {

		if ( this.shadowPass && ! clippingGroup.clipShadows ) return this;

		let context = this.clippingGroupContexts.get( clippingGroup );

		if ( context === undefined ) {

			context = new ClippingContext();
			this.clippingGroupContexts.set( clippingGroup, context );

		}

		context.update( this, clippingGroup );

		return context;

	}

}

export default ClippingContext;
