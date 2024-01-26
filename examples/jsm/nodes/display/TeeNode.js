import TempNode from '../core/TempNode.js';
import TextureNode from '../accessors/TextureNode.js';
import { NodeUpdateType } from '../core/constants.js';
import { nodeObject, addNodeElement } from '../shadernode/ShaderNode.js';
import { uv } from '../accessors/UVNode.js';
import QuadMesh from '../../objects/QuadMesh.js';

const quadMesh = new QuadMesh();

class TeeTextureNode extends TextureNode {

	constructor( teeNode, texture ) {

		super( texture );

		this.teeNode = teeNode;

		this.setUpdateMatrix( false );

	}

	setup( builder ) {

		this.teeNode.build( builder );

		return super.setup( builder );

	}

	clone() {

		return new this.constructor( this.teeNode, this.value );

	}

}

class TeeNode extends TempNode {

	constructor( textureNode, renderTarget ) {

		super( 'vec4' );

		this._renderTarget = renderTarget;

		this.updateBeforeType = NodeUpdateType.FRAME;

		this._textureNode = textureNode;

		this.isTeeNode = true;

		return nodeObject( new TeeTextureNode( this, textureNode.value ) );

	}

	isGlobal() {

		return true;

	}

	setup( builder ) {

		// use this for rendering to prevent infinte loop
		const textureNode  = this._textureNode;

		if ( textureNode.isTextureNode !== true ) {

			console.error( 'TeeNode requires a TextureNode.' );

			return vec4();

		}

		//

		const uvNode = textureNode.uvNode || uv();

		const sampleTexture = ( uv ) => textureNode.cache().context( { getUV: () => uv, forceUVContext: true } );

		const material = this._material || ( this._material = builder.createNodeMaterial() );

		material.fragmentNode = sampleTexture( uvNode );

		return textureNode;

	}

	updateBefore( frame ) {

		const { renderer } = frame;
		const currentRenderTarget = renderer.getRenderTarget();

		renderer.setRenderTarget( this._renderTarget );

		quadMesh.material = this._material;
		quadMesh.render( renderer );

		// restore

		renderer.setRenderTarget( currentRenderTarget );

	}

	dispose() {

		this._renderTarget.dispose();

	}

}

export default TeeNode;

export const tee = ( textureNode, renderTarget ) => nodeObject( new TeeNode( textureNode, renderTarget ) );

addNodeElement( 'tee', tee );
