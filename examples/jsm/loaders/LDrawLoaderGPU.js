import { LineBasicNodeMaterial } from 'three';
import { attribute, cameraProjectionMatrix, materialColor, modelViewMatrix, vec2, vec4,varyingProperty, Fn, positionLocal } from 'three/tsl';

import { LDrawLoader } from './LDrawLoaderCore.js';

class LDrawConditionalLineMaterial extends LineBasicNodeMaterial {

	static get type() {

		return 'LDrawConditionalLineMaterial';

	}

	constructor( parameters ) {

		super();

		this.positionNode = Fn( () => {

			const control0 = attribute( 'control0' );
			const control1  = attribute( 'control1' );
			const direction = attribute( 'direction' );

			const discardFlag = varyingProperty( 'float', 'discardFlag' );

			// Transform the line segment ends and control points into camera clip space
			const c0 = cameraProjectionMatrix.mul( modelViewMatrix ).mul( vec4( control0, 1.0 ) );
			const c1 = cameraProjectionMatrix.mul( modelViewMatrix ).mul( vec4( control1, 1.0 ) );
			const p0 = cameraProjectionMatrix.mul( modelViewMatrix ).mul( vec4( positionLocal, 1.0 ) );
			const p1 = cameraProjectionMatrix.mul( modelViewMatrix ).mul( vec4( positionLocal.add( direction ), 1.0 ) );

			c0.xy.divAssign( c0.w );
			c1.xy.divAssign( c1.w );
			p0.xy.divAssign( p0.w );
			p1.xy.divAssign( p1.w );

			// Get the direction of the segment and an orthogonal vector
			const dir = p1.xy.sub( p0.xy ).toVar();
			const norm = vec2( dir.y.negate(), dir.x ).toVar();

			// Get control point directions from the line
			const c0dir = c0.xy.sub( p1.xy );
			const c1dir = c1.xy.sub( p1.xy );

			// If the vectors to the controls points are pointed in different directions away
			// from the line segment then the line should not be drawn.
			const d0 = norm.normalize().dot( c0dir.normalize() );
			const d1 = norm.normalize().dot( c1dir.normalize() );

			discardFlag.assign( d0.sign().sub( d1.sign() ).abs() );

			return positionLocal;

		} )();


		this.colorNode = Fn( () => {

			const discardFlag = varyingProperty( 'float', 'discardFlag' );

			discardFlag.greaterThan( 0.5 ).discard();

			return materialColor;

		} )();

		this.setValues( parameters );

		this.isLDrawConditionalLineMaterial = true;

	}

}

LDrawLoader.lDrawConditionalLineMaterial = LDrawConditionalLineMaterial;

export { LDrawLoader };
