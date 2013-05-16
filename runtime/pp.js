/*******************************************************************************
 * Copyright (c) 2013 Max Schaefer.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Max Schaefer - initial API and implementation
 *******************************************************************************/

/*global FunctionClass HiddenClass InstanceClass ObjClass UnionClass PrimitiveClass GlobalClass add NUMBER BOOLEAN STRING REGEXP UNDEFINED NULL */

// helper functions for creating ASTs
function mkAssignStmt(lhs, rhs) {
	return {
		type: 'ExpressionStatement',
		expression: {
			type: 'AssignmentExpression',
			operator: '=',
			left: lhs,
			right: rhs
		}
	};
}

function isIdentifier(str) {
	return str.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/);
}

function mkMemberExpression(obj, prop) {
	if(typeof obj === 'string')
		obj = { type: 'Identifier', name: obj };
		
	if (isIdentifier(prop))
	    return {
			type: 'MemberExpression',
			computed: false,
			object: obj,
			property: {
				type: 'Identifier',
				name: prop
			}
	    };
	else
	    return {
			type: 'MemberExpression',
			computed: true,
			object: obj,
			property: {
				type: 'Literal',
				value: prop,
				raw: prop
			}
	    };
}

function mkProperty(name, value) {
	if(isIdentifier(name))
		return {
			type: 'Property',
			key: {
				type: 'Identifier',
				name: name
			},
			value: value,
			kind: 'init'
		};
	else
		return {
			type: 'Property',
			key: {
				type: 'Literal',
				value: name,
				raw: name
			},
			value: value,
			kind: 'init'
		};
}

function mkThis() {
	return { type: 'ThisExpression' };
}

function mkReturn(expr) {
	return {
		type: 'ReturnStatement',
		argument: expr
	};
}

function mkOr(left, right) {
	return {
		type: 'LogicalExpression',
		operator: '||',
		left: left,
		right: right
	};
}

function isEmptyObjectLiteral(obj) {
	return obj.type === 'ObjectExpression' &&
		   obj.properties.length === 0;
}

FunctionClass.prototype.generate_asg = function(decls) {
	if(this.asg)
		return this.asg;
		
	var body = [];
	this.asg = {
		type: 'FunctionExpression',
		id: null,
		params: [],
		defaults: [],
		body: {
			type: 'BlockStatement',
			body: body
		},
		rest: null,
		generator: false,
		expression: false,
		temp_name: this.mkTempName()
	};
				 
	for(var p in this.properties) {
		if(p.substring(0, 2) === '$$') {
		    var prop_name = p.substring(2);
		    var prop_asg = this.properties[p].generate_asg(decls);

		    // don't include trivial function prototypes
		    if (prop_name !== 'prototype' || !isEmptyObjectLiteral(prop_asg))
				decls.push(mkAssignStmt(mkMemberExpression(this.asg, prop_name), prop_asg));
		}
	}
	
	var maxparm = -1;
	this.callees.forEach(function(callee_info) {
		var callee = callee_info[0],
		    args = callee_info[1];
		    
		if(typeof callee === 'number') {
			maxparm = Math.max(maxparm, callee);
			callee = { type: 'Identifier', name: 'p' + callee };
		} else {
			callee = callee.generate_asg(decls);
		}
		
		args.forEach(function(arg, i) {
			if(typeof arg === 'number') {
				maxparm = Math.max(maxparm, arg);
				args[i] = { type: 'Identifier', name: 'p' + arg };
			} else if(arg) {
				args[i] = arg.generate_asg(decls);
			} else {
				args[i] = { type: 'Literal', value: null, raw: "null" };
			}
		});
		
		body.push({
					type: 'ExpressionStatement',
					expression: {
						type: 'CallExpression',
						callee: callee,
						'arguments': args
					}
				  });
	});
	
	for(var i=0;i<=maxparm;++i)
		this.asg.params.push({ type: 'Identifier', name: 'p' + i });

    if(this.fn.__instance_class)
		for(p in this.fn.__instance_class.properties)
		    if(p.substring(0, 2) === '$$')
				body.push(mkAssignStmt(mkMemberExpression(mkThis(), p.substring(2)),  this.fn.__instance_class.properties[p].generate_asg(decls)));

	if(this.properties['return'])
		body.push(mkReturn(this.properties['return'].generate_asg(decls)));
		
	return this.asg;
};

ObjClass.prototype.generate_asg = function(decls) {
	if(this.asg)
		return this.asg;
		
	var props = [];
	this.asg = { type: 'ObjectExpression',
				 properties: props,
				 temp_name: this.mkTempName() };
		
	for(var p in this.properties)
		if(p.substring(0, 2) === '$$')
			props.push(mkProperty(p.substring(2), this.properties[p].generate_asg(decls)));

	return this.asg;
};
	
InstanceClass.prototype.generate_asg = function(decls) {
	if(this.asg)
		return this.asg;
		
	this.asg = { type: 'NewExpression',
				 callee: this.fnclass.generate_asg(decls),
				 'arguments': [],
				 temp_name: this.mkTempName() };
	
    return this.asg;
};

UnionClass.prototype.generate_asg = function(decls) {
	if(this.asg)
		return this.asg;

	if(this.members.length === 1) {
		this.asg = this.members[0].generate_asg(decls);
	} else {
		var n = this.members.length;
		this.asg = mkOr(this.members[0].generate_asg(decls), this.members[1].generate_asg(decls));
		for(var i=2;i<n;++i)
			this.asg = mkOr(this.asg, this.members[i].generate_asg(decls));
	}
	
	this.asg.temp_name = "tmp_" + this.id;

    return this.asg;
};
	
PrimitiveClass.prototype.generate_asg = function(decls) {
    return this.asg;
};

NUMBER.asg = { type: 'CallExpression', callee: mkMemberExpression("Math", "random"), 'arguments': [], temp_name: '$$NUMBER$$' };
BOOLEAN.asg = { type: 'UnaryExpression', operator: '!', argument: NUMBER.asg, temp_name: '$$BOOLEAN$$' };
STRING.asg = { type: 'NewExpression', callee: { type: 'Identifier', name: 'String' }, 'arguments': [NUMBER.asg], temp_name: '$$STRING$$' };
REGEXP.asg = { type: 'NewExpression', callee: { type: 'Identifier', name: 'RegExp' }, 'arguments': [STRING.asg], temp_name: '$$REGEXP$$' };

UNDEFINED.generate_asg = function() {
	return { type: 'UnaryExpression', operator: 'void', argument: { type: 'Literal', value: 0, raw: "0" } };
};
NULL.generate_asg = function() {
	return { type: 'Literal', value: null, raw: 'null' };
};

GlobalClass.prototype.generate_asg = function(decls) {
    if(!this.name) {
		this.name = this.mkTempName();
		decls.push({
			type: 'VariableDeclaration',
			declarations: [
				{
					type: 'VariableDeclarator',
					id: {
						type: 'Identifier',
						name: this.name
					},
					init: {
						type: 'ThisExpression'
					}
				}
			],
			kind: 'var'
		});
    }
	return { type: 'Identifier', name: this.name };
};