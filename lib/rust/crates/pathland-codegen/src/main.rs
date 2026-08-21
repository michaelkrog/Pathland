//! # pathland-codegen
//!
//! The **Catalog-Driven DSL generator**. It reads the single source of truth at
//! `lib/ui/components.yaml`, asserts every component/property id against
//! `pathland_opcode::constants` (a hard error on mismatch — the consistency
//! safety net), and emits the checked-in SwiftUI-like DSL for each target
//! language (currently Java).
//!
//! ## Usage
//!
//! ```sh
//! cargo run -p pathland-codegen
//! ```
//!
//! The generator is deterministic: given the same catalog it writes identical
//! output, so the emitted files are safe to check in.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use pathland_opcode::{component_type, property_id, size};

// ---------------------------------------------------------------------------
// YAML model
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
struct Catalog {
    component_ids: BTreeMap<String, u16>,
    property_ids: BTreeMap<String, u16>,
    enums: BTreeMap<String, EnumDef>,
    components: BTreeMap<String, ComponentDef>,
    modifiers: Vec<ModifierDef>,
    #[allow(dead_code)] // frame compound modifier is emitted by emit_frame
    compound_modifiers: BTreeMap<String, CompoundDef>,
}

#[derive(serde::Deserialize)]
struct EnumDef {
    property: String,
    values: BTreeMap<String, u8>,
}

#[derive(serde::Deserialize)]
struct ComponentDef {
    label: String,
    #[serde(default)]
    text_content: bool,
    #[serde(default)]
    children: bool,
    #[serde(default)]
    constructor_props: Vec<ConstructorProp>,
}

#[derive(serde::Deserialize)]
struct ConstructorProp {
    property: String,
    #[serde(rename = "type")]
    ty: String,
    #[serde(default)]
    r#enum: Option<String>,
}

#[derive(serde::Deserialize)]
struct ModifierDef {
    property: String,
    #[serde(rename = "type")]
    ty: String,
    #[serde(default)]
    r#enum: Option<String>,
}

#[derive(serde::Deserialize)]
struct CompoundDef {
    #[allow(dead_code)]
    properties: Vec<ModifierDef>,
}

// ---------------------------------------------------------------------------
// Assertions against pathland_opcode::constants
// ---------------------------------------------------------------------------

fn assert_ids(catalog: &Catalog) -> Vec<String> {
    let mut errors = Vec::new();

    let expected_components: &[(&str, u16)] = &[
        ("hstack", component_type::HSTACK),
        ("vstack", component_type::VSTACK),
        ("text", component_type::TEXT),
        ("button", component_type::BUTTON),
        ("image", component_type::IMAGE),
        ("switch", component_type::SWITCH),
        ("text_field", component_type::TEXT_FIELD),
        ("spacer", component_type::SPACER),
        ("scrollview", component_type::SCROLLVIEW),
        ("list", component_type::LIST),
        ("grid", component_type::GRID),
        ("comment", component_type::COMMENT),
    ];
    for (name, id) in expected_components {
        match catalog.component_ids.get(*name) {
            Some(cid) if cid == id => {}
            Some(cid) => errors.push(format!(
                "component `{name}`: catalog 0x{cid:04x} != protocol 0x{id:04x}"
            )),
            None => errors.push(format!("component `{name}` missing from catalog")),
        }
    }

    let expected_props: &[(&str, u16)] = &[
        ("spacing", property_id::SPACING),
        ("alignment", property_id::ALIGNMENT),
        ("padding", property_id::PADDING),
        ("content_margins", property_id::CONTENT_MARGINS),
        ("text", property_id::TEXT),
        ("line_limit", property_id::LINE_LIMIT),
        ("text_alignment", property_id::TEXT_ALIGNMENT),
        ("truncation_mode", property_id::TRUNCATION_MODE),
        ("background_color", property_id::BACKGROUND_COLOR),
        ("border_width", property_id::BORDER_WIDTH),
        ("border_color", property_id::BORDER_COLOR),
        ("border_radius", property_id::BORDER_RADIUS),
        ("padding_style", property_id::PADDING_STYLE),
        ("font_size", property_id::FONT_SIZE),
        ("font_weight", property_id::FONT_WEIGHT),
        ("font_family", property_id::FONT_FAMILY),
        ("color", property_id::COLOR),
        ("width", property_id::WIDTH),
        ("height", property_id::HEIGHT),
        ("opacity", property_id::OPACITY),
        ("visible", property_id::VISIBLE),
        ("z_index", property_id::Z_INDEX),
        ("clips_to_bounds", property_id::CLIPS_TO_BOUNDS),
        ("padding_top", property_id::PADDING_TOP),
        ("padding_right", property_id::PADDING_RIGHT),
        ("padding_bottom", property_id::PADDING_BOTTOM),
        ("padding_left", property_id::PADDING_LEFT),
        ("role", property_id::ROLE),
        ("state", property_id::STATE),
        ("enabled", property_id::ENABLED),
        ("selected", property_id::SELECTED),
    ];
    for (name, id) in expected_props {
        match catalog.property_ids.get(*name) {
            Some(pid) if pid == id => {}
            Some(pid) => errors.push(format!(
                "property `{name}`: catalog 0x{pid:04x} != protocol 0x{id:04x}"
            )),
            None => errors.push(format!("property `{name}` missing from catalog")),
        }
    }

    for (enum_name, def) in &catalog.enums {
        if !catalog.property_ids.contains_key(&def.property) {
            errors.push(format!(
                "enum `{enum_name}` references unknown property `{}`",
                def.property
            ));
        }
        if def.values.is_empty() {
            errors.push(format!("enum `{enum_name}` has no values"));
        }
    }

    errors
}

// ---------------------------------------------------------------------------
// Java emission helpers
// ---------------------------------------------------------------------------

fn java_dir(repo_root: &Path) -> PathBuf {
    repo_root.join("lib/java/pathland-demo/src/main/java/pathland")
}

fn write_java(path: &Path, content: &str) {
    std::fs::create_dir_all(path.parent().unwrap()).expect("create java dir");
    std::fs::write(path, content).expect("write java file");
}

fn header(file: &str) -> String {
    format!(
        "// GENERATED by pathland-codegen — DO NOT EDIT.\n// Source of truth: lib/ui/components.yaml ({file})\n"
    )
}

/// Java constant name for a component id (e.g. `Constants.HSTACK`).
fn component_const(name: &str) -> String {
    format!("Constants.{}", name.to_ascii_uppercase())
}

/// Java constant name for a property id (e.g. `Constants.PROP_ALIGNMENT`).
fn property_const(name: &str) -> String {
    format!("Constants.PROP_{}", name.to_ascii_uppercase())
}

/// Escape a DSL name into a valid Java method identifier (append `_` for
/// reserved keywords, e.g. `switch` -> `switch_`).
fn java_ident(name: &str) -> String {
    const JAVA_KEYWORDS: &[&str] = &[
        "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
        "const", "continue", "default", "do", "double", "else", "enum", "extends", "final",
        "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int",
        "interface", "long", "native", "new", "package", "private", "protected", "public",
        "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this",
        "throw", "throws", "transient", "try", "void", "volatile", "while", "true", "false",
        "null",
    ];
    if JAVA_KEYWORDS.contains(&name) {
        format!("{name}_")
    } else {
        name.to_string()
    }
}

// ---------------------------------------------------------------------------
// Emitters
// ---------------------------------------------------------------------------

fn emit_constants(catalog: &Catalog, repo_root: &Path) {
    let mut out = String::new();
    out.push_str(&header("Constants"));
    out.push_str("package pathland;\n\n");
    out.push_str("/** Protocol ids and size sentinels (mirrors pathland_opcode::constants). */\n");
    out.push_str("public final class Constants {\n");
    out.push_str("    private Constants() {}\n\n");

    out.push_str("    // --- size sentinels (WIDTH / HEIGHT) ---\n");
    out.push_str(&format!("    public static final float FILL = {}f;\n", size::FILL));
    out.push_str(&format!(
        "    public static final float HUG_CONTENT = {}f;\n",
        size::HUG_CONTENT
    ));

    out.push_str("\n    // --- component ids ---\n");
    for (name, id) in &catalog.component_ids {
        out.push_str(&format!(
            "    public static final int {} = 0x{:04X};\n",
            name.to_ascii_uppercase(),
            id
        ));
    }

    out.push_str("\n    // --- property ids ---\n");
    for (name, id) in &catalog.property_ids {
        out.push_str(&format!(
            "    public static final int PROP_{} = 0x{:04X};\n",
            name.to_ascii_uppercase(),
            id
        ));
    }

    out.push_str("}\n");
    write_java(&java_dir(repo_root).join("Constants.java"), &out);
}

fn emit_enum(name: &str, def: &EnumDef, catalog: &Catalog, repo_root: &Path) {
    let prop_id = catalog.property_ids.get(&def.property).copied().unwrap_or(0);
    let mut out = String::new();
    out.push_str(&header(&format!("enum `{name}`")));
    out.push_str("package pathland;\n\n");
    out.push_str(&format!(
        "/** Typed `{name}` values. Wire value is the protocol ENUM value; property `{}` = 0x{:04X}. */\n",
        def.property, prop_id
    ));
    out.push_str(&format!("public enum {name} {{\n"));
    let value_count = def.values.len();
    for (i, (value_name, value)) in def.values.iter().enumerate() {
        let sep = if i + 1 == value_count { ";" } else { "," };
        out.push_str(&format!(
            "    {}({}){sep}\n",
            value_name.to_ascii_uppercase(),
            value
        ));
    }
    out.push_str("\n    public final int wire;\n");
    out.push_str(&format!(
        "    public final int property = {};\n",
        property_const(&def.property)
    ));
    out.push_str("\n    public int wire() { return wire; }\n");
    out.push_str(&format!(
        "\n    {name}(int wire) {{ this.wire = wire; }}\n"
    ));
    out.push_str("}\n");
    write_java(&java_dir(repo_root).join(format!("{name}.java")), &out);
}

fn emit_component_node(repo_root: &Path) {
    let mut out = String::new();
    out.push_str(&header("ComponentNode"));
    out.push_str("package pathland;\n\n");
    out.push_str("import java.util.ArrayList;\n");
    out.push_str("import java.util.List;\n\n");
    out.push_str("/** A component node (mirrors a DSL component). Constructor props are set on build. */\n");
    out.push_str("public final class ComponentNode implements View {\n");
    out.push_str("    private final int componentId;\n");
    out.push_str("    private final String text;\n");
    out.push_str("    private final List<View> children = new ArrayList<>();\n");
    out.push_str("    private final java.util.Map<Integer, Float> constructorProps = new java.util.LinkedHashMap<>();\n\n");
    out.push_str("    public ComponentNode(int componentId, String text, List<View> children) {\n");
    out.push_str("        this.componentId = componentId;\n");
    out.push_str("        this.text = text;\n");
    out.push_str("        this.children.addAll(children);\n");
    out.push_str("    }\n\n");
    out.push_str("    public ComponentNode setConstructorProp(int property, float value) {\n");
    out.push_str("        constructorProps.put(property, value);\n");
    out.push_str("        return this;\n");
    out.push_str("    }\n\n");
    out.push_str("    @Override\n");
    out.push_str("    public Node build() {\n");
    out.push_str("        Node node = new Node(0, componentId);\n");
    out.push_str("        if (text != null) node.string = text;\n");
    out.push_str("        node.properties.putAll(constructorProps);\n");
    out.push_str("        for (View child : children) node.children.add(child.build());\n");
    out.push_str("        return node;\n");
    out.push_str("    }\n");
    out.push_str("}\n");
    write_java(&java_dir(repo_root).join("ComponentNode.java"), &out);
}

fn emit_view(catalog: &Catalog, repo_root: &Path) {
    let mut out = String::new();
    out.push_str(&header("View"));
    out.push_str("package pathland;\n\n");
    out.push_str("/**\n");
    out.push_str(" * A composable view. Implementations build a {@link Node} subtree.\n");
    out.push_str(" *\n");
    out.push_str(" * Global modifiers are chainable on any view. The compound `frame` modifier\n");
    out.push_str(" * sizes a view (FILL/HUG_CONTENT sentinels) and optionally aligns it.\n");
    out.push_str(" */\n");
    out.push_str("public interface View {\n");
    out.push_str("    Node build();\n\n");

    for m in &catalog.modifiers {
        // Skip string-valued properties (e.g. font_family): the Java bridge
        // currently round-trips float properties only. They remain in the
        // catalog for future languages.
        if m.ty == "string" {
            continue;
        }
        let method = m.property.clone();
        let (jt, arg) = match m.ty.as_str() {
            "bool" => ("boolean".to_string(), "value".to_string()),
            "enum" => (
                m.r#enum.as_deref().unwrap_or("int").to_string(),
                "value".to_string(),
            ),
            "color" => ("int".to_string(), "rgba".to_string()),
            _ => ("float".to_string(), "value".to_string()),
        };
        let value_expr = match m.ty.as_str() {
            "color" => format!("Float.intBitsToFloat({arg})"),
            "bool" => format!("{arg} ? 1f : 0f"),
            "enum" => format!("{arg}.wire"),
            _ => arg.to_string(),
        };
        out.push_str(&format!(
            "    default View {method}({jt} {arg}) {{\n"
        ));
        out.push_str(&format!(
            "        return new Modified(this, {}, {value_expr});\n",
            property_const(&m.property)
        ));
        out.push_str("    }\n\n");
    }

    out.push_str("    /**\n");
    out.push_str("     * Compound sizing modifier. Pass {@link Constants#FILL} / {@link Constants#HUG_CONTENT}\n");
    out.push_str("     * for a fixed axis, or {@code Float.NaN} to leave it to the native renderer.\n");
    out.push_str("     *\n");
    out.push_str("     * @param width     width hint (FILL / HUG_CONTENT / NaN for unset)\n");
    out.push_str("     * @param height    height hint (FILL / HUG_CONTENT / NaN for unset)\n");
    out.push_str("     * @param alignment cross-axis alignment, or null for unset\n");
    out.push_str("     */\n");
    out.push_str("    default View frame(float width, float height, Align alignment) {\n");
    out.push_str("        java.util.Map<Integer, Float> props = new java.util.LinkedHashMap<>();\n");
    out.push_str("        if (!Float.isNaN(width)) props.put(Constants.PROP_WIDTH, width);\n");
    out.push_str("        if (!Float.isNaN(height)) props.put(Constants.PROP_HEIGHT, height);\n");
    out.push_str("        if (alignment != null) props.put(Constants.PROP_ALIGNMENT, (float) alignment.wire);\n");
    out.push_str("        return new Modified(this, props);\n");
    out.push_str("    }\n");
    out.push_str("}\n");
    write_java(&java_dir(repo_root).join("View.java"), &out);
}

fn emit_dsl(catalog: &Catalog, repo_root: &Path) {
    let mut out = String::new();
    out.push_str(&header("DSL"));
    out.push_str("package pathland;\n\n");
    out.push_str("import java.util.Arrays;\n");
    out.push_str("import java.util.List;\n\n");
    out.push_str("/**\n");
    out.push_str(" * Static DSL entry points. Component CONSTRUCTOR properties are passed as\n");
    out.push_str(" * constructor args (never chainable); global modifiers chain on any view.\n");
    out.push_str(" */\n");
    out.push_str("public final class DSL {\n");
    out.push_str("    private DSL() {}\n\n");

    for (name, comp) in &catalog.components {
        let comp_const = component_const(name);
        let method = java_ident(name);
        let has_text = comp.text_content;
        let has_children = comp.children;

        // 1) Default factory.
        let default_doc = if has_text {
            format!("Create a {} with the given text content.", comp.label)
        } else if has_children {
            format!("Create a {} with the given children.", comp.label)
        } else {
            format!("Create a {}.", comp.label)
        };
        out.push_str(&format!("    /** {default_doc} */\n"));
        if has_text {
            out.push_str(&format!(
                "    public static View {method}(String content) {{\n"
            ));
            out.push_str(&format!(
                "        return new ComponentNode({comp_const}, content, java.util.Collections.emptyList());\n"
            ));
        } else if has_children {
            out.push_str(&format!("    public static View {method}(View... children) {{\n"));
            out.push_str(&format!(
                "        return new ComponentNode({comp_const}, null, Arrays.asList(children));\n"
            ));
        } else {
            out.push_str(&format!("    public static View {method}() {{\n"));
            out.push_str(&format!(
                "        return new ComponentNode({comp_const}, null, java.util.Collections.emptyList());\n"
            ));
        }
        out.push_str("    }\n\n");

        // 2) Constructor-properties overload (only if the component has any).
        if !comp.constructor_props.is_empty() {
            let mut params = Vec::new();
            let mut setter_calls = Vec::new();
            for prop in &comp.constructor_props {
                let jt = match prop.ty.as_str() {
                    "enum" => prop.r#enum.as_deref().unwrap_or("int").to_string(),
                    "u32" => "int".to_string(),
                    "bool" => "boolean".to_string(),
                    _ => "float".to_string(),
                };
                let pname = short_name(&prop.property);
                params.push(format!("{jt} {pname}"));
                let wire_expr = match prop.ty.as_str() {
                    "enum" => format!("{pname}.wire"),
                    "bool" => format!("{pname} ? 1f : 0f"),
                    "u32" => format!("(float) {pname}"),
                    _ => pname.clone(),
                };
                setter_calls.push(format!(
                    "        node.setConstructorProp({}, {});\n",
                    property_const(&prop.property),
                    wire_expr
                ));
            }
            params.push(if has_text {
                "String content".to_string()
            } else if has_children {
                "View... children".to_string()
            } else {
                String::new()
            });
            let params = params
                .into_iter()
                .filter(|p| !p.is_empty())
                .collect::<Vec<_>>()
                .join(", ");

            out.push_str(&format!(
                "    /** Create a {} with constructor properties (structural/layout — never chainable). */\n",
                comp.label
            ));
            out.push_str(&format!(
                "    public static View {method}({params}) {{\n"
            ));
            let node_ctor = if has_text {
                format!(
                    "new ComponentNode({comp_const}, content, java.util.Collections.emptyList())"
                )
            } else if has_children {
                format!("new ComponentNode({comp_const}, null, Arrays.asList(children))")
            } else {
                format!("new ComponentNode({comp_const}, null, java.util.Collections.emptyList())")
            };
            out.push_str(&format!("        ComponentNode node = {node_ctor};\n"));
            for call in setter_calls {
                out.push_str(&call);
            }
            out.push_str("        return node;\n");
            out.push_str("    }\n\n");
        }
    }

    out.push_str("}\n");
    write_java(&java_dir(repo_root).join("DSL.java"), &out);
}

fn short_name(prop: &str) -> String {
    prop.replace('_', "")
}

fn emit_modified(repo_root: &Path) {
    let mut out = String::new();
    out.push_str(&header("Modified"));
    out.push_str("package pathland;\n\n");
    out.push_str("/**\n");
    out.push_str(" * A view wrapped by one or more property modifiers (innermost-first).\n");
    out.push_str(" * Simple modifiers use the single-property constructor; the compound\n");
    out.push_str(" * `frame` modifier uses the map constructor for width/height/alignment.\n");
    out.push_str(" */\n");
    out.push_str("final class Modified implements View {\n");
    out.push_str("    private final View inner;\n");
    out.push_str("    private final java.util.Map<Integer, Float> props;\n\n");
    out.push_str("    Modified(View inner, int propertyId, float value) {\n");
    out.push_str("        this.inner = inner;\n");
    out.push_str("        this.props = new java.util.LinkedHashMap<>();\n");
    out.push_str("        this.props.put(propertyId, value);\n");
    out.push_str("    }\n\n");
    out.push_str("    Modified(View inner, java.util.Map<Integer, Float> props) {\n");
    out.push_str("        this.inner = inner;\n");
    out.push_str("        this.props = props;\n");
    out.push_str("    }\n\n");
    out.push_str("    @Override\n");
    out.push_str("    public Node build() {\n");
    out.push_str("        Node node = inner.build();\n");
    out.push_str("        node.properties.putAll(props);\n");
    out.push_str("        return node;\n");
    out.push_str("    }\n");
    out.push_str("}\n");
    write_java(&java_dir(repo_root).join("Modified.java"), &out);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fn main() {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(4)
        .expect("resolve repo root");

    let catalog_path = repo_root.join("lib/ui/components.yaml");
    let catalog_text = std::fs::read_to_string(&catalog_path)
        .unwrap_or_else(|e| panic!("read {}: {e}", catalog_path.display()));
    let catalog: Catalog =
        serde_yaml::from_str(&catalog_text).expect("parse lib/ui/components.yaml");

    let errors = assert_ids(&catalog);
    if !errors.is_empty() {
        eprintln!("pathland-codegen: catalog/constants mismatch:");
        for e in &errors {
            eprintln!("  - {e}");
        }
        std::process::exit(1);
    }

    emit_constants(&catalog, &repo_root);
    for (name, def) in &catalog.enums {
        emit_enum(name, def, &catalog, &repo_root);
    }
    emit_component_node(&repo_root);
    emit_view(&catalog, &repo_root);
    emit_dsl(&catalog, &repo_root);
    emit_modified(&repo_root);

    println!(
        "pathland-codegen: OK — {} components, {} properties, {} enums asserted against constants; Java DSL emitted.",
        catalog.components.len(),
        catalog.property_ids.len(),
        catalog.enums.len()
    );
}
