// Original src: https://github.com/zz85/threejs-path-flow
const CHANNELS = 4;
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 4;

import {
	DataTexture,
	DataUtils,
	RGBAFormat,
	HalfFloatType,
	RepeatWrapping,
	Mesh,
	InstancedMesh,
	LinearFilter,
	DynamicDrawUsage,
	InstancedBufferGeometry,
	InstancedBufferAttribute,
} from 'three';

import { attribute, modelWorldMatrix, normalLocal, vec2, vec3, vec4, mat3, varyingProperty, texture, reference, Fn, select, positionLocal } from 'three/tsl';

/**
 * Make a new DataTexture to store the descriptions of the curves.
 *
 * @param { number } numberOfCurves the number of curves needed to be described by this texture.
 */
export function initSplineTexture( numberOfCurves = 1 ) {

	const dataArray = new Uint16Array( TEXTURE_WIDTH * TEXTURE_HEIGHT * numberOfCurves * CHANNELS );
	const dataTexture = new DataTexture(
		dataArray,
		TEXTURE_WIDTH,
		TEXTURE_HEIGHT * numberOfCurves,
		RGBAFormat,
		HalfFloatType
	);

	dataTexture.wrapS = RepeatWrapping;
	dataTexture.wrapY = RepeatWrapping;
	dataTexture.magFilter = LinearFilter;
	dataTexture.minFilter = LinearFilter;
	dataTexture.needsUpdate = true;

	return dataTexture;

}

/**
 * Write the curve description to the data texture
 *
 * @param { DataTexture } texture The DataTexture to write to
 * @param { Curve } splineCurve The curve to describe
 * @param { number } offset Which curve slot to write to
 */
export function updateSplineTexture( texture, splineCurve, offset = 0 ) {

	const numberOfPoints = Math.floor( TEXTURE_WIDTH * ( TEXTURE_HEIGHT / 4 ) );
	splineCurve.arcLengthDivisions = numberOfPoints / 2;
	splineCurve.updateArcLengths();
	const points = splineCurve.getSpacedPoints( numberOfPoints );
	const frenetFrames = splineCurve.computeFrenetFrames( numberOfPoints, true );

	for ( let i = 0; i < numberOfPoints; i ++ ) {

		const rowOffset = Math.floor( i / TEXTURE_WIDTH );
		const rowIndex = i % TEXTURE_WIDTH;

		let pt = points[ i ];
		setTextureValue( texture, rowIndex, pt.x, pt.y, pt.z, 0 + rowOffset + ( TEXTURE_HEIGHT * offset ) );
		pt = frenetFrames.tangents[ i ];
		setTextureValue( texture, rowIndex, pt.x, pt.y, pt.z, 1 + rowOffset + ( TEXTURE_HEIGHT * offset ) );
		pt = frenetFrames.normals[ i ];
		setTextureValue( texture, rowIndex, pt.x, pt.y, pt.z, 2 + rowOffset + ( TEXTURE_HEIGHT * offset ) );
		pt = frenetFrames.binormals[ i ];
		setTextureValue( texture, rowIndex, pt.x, pt.y, pt.z, 3 + rowOffset + ( TEXTURE_HEIGHT * offset ) );

	}

	texture.needsUpdate = true;

}


function setTextureValue( texture, index, x, y, z, o ) {

	const image = texture.image;
	const { data } = image;
	const i = CHANNELS * TEXTURE_WIDTH * o; // Row Offset

	data[ index * CHANNELS + i + 0 ] = DataUtils.toHalfFloat( x );
	data[ index * CHANNELS + i + 1 ] = DataUtils.toHalfFloat( y );
	data[ index * CHANNELS + i + 2 ] = DataUtils.toHalfFloat( z );
	data[ index * CHANNELS + i + 3 ] = DataUtils.toHalfFloat( 1 );

}

/**
 * Create a new set of uniforms for describing the curve modifier
 *
 * @param { DataTexture } Texture which holds the curve description
 */
export function getUniforms( splineTexture ) {

	return {
		spineTexture: splineTexture,
		pathOffset: 0, // time of path curve
		pathSegment: 1, // fractional length of path
		spineOffset: 161,
		spineLength: 400,
		flow: 1, // int
	};

}

export function modifyShader( material, uniforms, numberOfCurves, isInstanced ) {

	const spineTexture = uniforms.spineTexture;

	const pathOffset = reference( 'pathOffset', 'float', uniforms );
	const pathSegment = reference( 'pathSegment', 'float', uniforms );
	const spineOffset = reference( 'spineOffset', 'float', uniforms );
	const spineLength = reference( 'spineLength', 'float', uniforms );
	const flow = reference( 'flow', 'float', uniforms );

	material.positionNode = Fn( () => {

		const textureStacks = TEXTURE_HEIGHT / 4;
		const textureScale = TEXTURE_HEIGHT * numberOfCurves;

		const worldPos = modelWorldMatrix.mul( vec4( positionLocal, 1 ) ).toVar();

		const bend = flow.greaterThan( 0 ).toVar();
		const xWeight = select( bend, 0, 1 ).toVar();

		const instanceTranslation = attribute( 'instanceTranslation' );

		let mt, spinePortion;

		if ( isInstanced ) {

			const pathOffsetFromInstance = instanceTranslation.z.toVar();
			const spineLengthFromInstance = instanceTranslation.x.toVar();

			spinePortion = select( bend, worldPos.x.add( spineOffset ).div( spineLengthFromInstance ), 0 );
			mt = spinePortion.mul( pathSegment ).add( pathOffset ).add( pathOffsetFromInstance ).mul( textureStacks ).toVar();

		} else {

			spinePortion = select( bend, worldPos.x.add( spineOffset ).div( spineLength ), 0 );
			mt = spinePortion.mul( pathSegment ).add( pathOffset ).mul( textureStacks ).toVar();

		}

		mt.assign( mt.mod( textureStacks ) );

		const rowOffset = mt.floor().toVar();

		if ( isInstanced ) rowOffset.addAssign( instanceTranslation.y.mul( TEXTURE_HEIGHT ) );

		const spinePos = texture( spineTexture, vec2( mt, rowOffset.add( 0.5 ).div( textureScale ) ) ).xyz;

		const a = texture( spineTexture, vec2( mt, rowOffset.add( 1.5 ).div( textureScale ) ) ).xyz;
		const b = texture( spineTexture, vec2( mt, rowOffset.add( 2.5 ).div( textureScale ) ) ).xyz;
		const c = texture( spineTexture, vec2( mt, rowOffset.add( 3.5 ).div( textureScale ) ) ).xyz;

		const basis = mat3( a, b, c ).toVar();

		varyingProperty( 'vec3', 'curveNormal' ).assign( basis.mul( normalLocal ) );

		return basis.mul( vec3( worldPos.x.mul( xWeight ), worldPos.y, worldPos.z ) ).add( spinePos );

	} )();

	material.normalNode = varyingProperty( 'vec3', 'curveNormal' );

	if ( isInstanced ) {

		material.colorNode = attribute( 'instanceColor' );

	}

}

/**
 * A helper class for making meshes bend around curves
 */
export class Flow {

	/**
	 * @param {Mesh} mesh The mesh to clone and modify to bend around the curve
	 * @param {number} numberOfCurves The amount of space that should preallocated for additional curves
	 */
	constructor( mesh, numberOfCurves = 1 ) {

		const obj3D = mesh.clone();
		const splineTexure = initSplineTexture( numberOfCurves );
		const uniforms = getUniforms( splineTexure );

		const isInstanced = obj3D.geometry.isInstancedBufferGeometry === true;

		obj3D.traverse( function ( child ) {

			if (
				child instanceof Mesh ||
				child instanceof InstancedMesh
			) {

				if ( Array.isArray( child.material ) ) {

					const materials = [];

					for ( const material of child.material ) {

						const newMaterial = material.clone();
						modifyShader( newMaterial, uniforms, numberOfCurves, isInstanced );
						materials.push( newMaterial );

					}

					child.material = materials;

				} else {

					child.material = child.material.clone();
					modifyShader( child.material, uniforms, numberOfCurves, isInstanced );

				}

			}

		} );

		this.curveArray = new Array( numberOfCurves );
		this.curveLengthArray = new Array( numberOfCurves );

		this.object3D = obj3D;
		this.splineTexure = splineTexure;
		this.uniforms = uniforms;

	}

	updateCurve( index, curve ) {

		if ( index >= this.curveArray.length ) throw Error( 'Index out of range for Flow' );

		const curveLength = curve.getLength();

		this.uniforms.spineLength = curveLength;
		this.curveLengthArray[ index ] = curveLength;
		this.curveArray[ index ] = curve;

		updateSplineTexture( this.splineTexure, curve, index );

	}

	moveAlongCurve( amount ) {

		this.uniforms.pathOffset += amount;

	}

}


function _makeInstancedMesh( mesh, instanceTranslation, instanceColor, count ) {

	const instancedGeometry = new InstancedBufferGeometry().copy( mesh.geometry );

	instancedGeometry.setAttribute( 'instanceTranslation', instanceTranslation );
	instancedGeometry.setAttribute( 'instanceColor', instanceColor );

	instancedGeometry.instanceCount = count;

	const instanceMesh = new Mesh(
		instancedGeometry,
		mesh.material,
		count
	);

	instanceMesh.frustumCulled = false;

	return instanceMesh;

}

/**
 * A helper class for creating instanced versions of flow, where the instances are placed on the curve.
 */
export class InstancedFlow extends Flow {

	/**
	 *
	 * @param {number} count The number of instanced elements
	 * @param {number} curveCount The number of curves to preallocate for
	 * @param {Geometry} geometry The geometry to use for the instanced mesh
	 * @param {Material} material The material to use for the instanced mesh
	 */
	constructor( count, curveCount, mesh ) {

		const instanceTranslation = new InstancedBufferAttribute( new Float32Array( count * 3 ), 3 );
		const instanceColor = new InstancedBufferAttribute( new Float32Array( count * 3 ), 3 );

		instanceTranslation.usage = DynamicDrawUsage;

		// TODO replace tree below mesh
		const instanceMesh = _makeInstancedMesh( mesh, instanceTranslation, instanceColor, count );

		super( instanceMesh, curveCount );

		this.instanceTranslation = instanceTranslation;
		this.instanceColor = instanceColor;

		this.offsets = new Array( count ).fill( 0 );
		this.whichCurve = new Array( count ).fill( 0 );

	}

	/**
	 * The extra information about which curve and curve position is stored in the translation components of the matrix for the instanced objects
	 * This writes that information to the matrix and marks it as needing update.
	 *
	 * @param {number} index of the instanced element to update
	 */
	writeChanges( index ) {

		this.instanceTranslation.setXYZ(
			index,
			this.curveLengthArray[ this.whichCurve[ index ] ],
			this.whichCurve[ index ],
			this.offsets[ index ]
		);

		this.instanceTranslation.needsUpdate = true;

	}

	/**
	 * Move an individual element along the curve by a specific amount
	 *
	 * @param {number} index Which element to update
	 * @param {number} offset Move by how much
	 */
	moveIndividualAlongCurve( index, offset ) {

		this.offsets[ index ] += offset;
		this.writeChanges( index );

	}

	/**
	 * Select which curve to use for an element
	 *
	 * @param {number} index the index of the instanced element to update
	 * @param {number} curveNo the index of the curve it should use
	 */
	setCurve( index, curveNo ) {

		if ( isNaN( curveNo ) ) throw Error( 'curve index being set is Not a Number (NaN)' );
		this.whichCurve[ index ] = curveNo;
		this.writeChanges( index );

	}

	setColorAt( index, color ) {

		this.instanceColor.setXYZ( index, color.r, color.g, color.b );

		this.instanceColor.needsUpdate = true;

	}

}
