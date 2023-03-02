import { useState, useRef, useEffect, useMemo, ChangeEvent } from 'react';
import { invoke } from "@tauri-apps/api/tauri"
import Link from 'next/link'

import styles from '../styles/Category.module.css'

// Information for the tick box that selects categories or codes
interface CategorySelector {
    checked: boolean;
    enabled: boolean;
    onChange: () => void;
}

function Checkbox({ checked, enabled, onChange }: CategorySelector) {
    const checkboxRef = useRef<HTMLInputElement>(null);
    return (
        <label>
            <input
                ref={checkboxRef}
                type="checkbox"
                checked={checked}
                onChange={onChange}
            />
        </label>
    );
};

// TODO: Should really combine this with Code below, because
// the are the same apart from the child and category renamed
// to code
interface Cat {
    groups?: string[];
    exclude?: string[];
    child?: Cat[];
    category?: string;
    code?: string;
    docs: string;
    index: string;
}


// Establish whether the component should be included
// (i.e. ticked) and whether it should be enabled
// (grayed out or not)
function visible_status(cat: Cat, group: string, parent_exclude: boolean) {
    // Component is included by default, unless there
    // is an exclude tag at the current level, or
    // the parent is excluded
    let exclude_tag = false
    if (cat.exclude !== undefined) {
	exclude_tag = cat.exclude.includes(group);
    }
    let included = !exclude_tag && !parent_exclude

    // Checkbox is enabled if the parent is not excluded
    let enabled = !parent_exclude;

    return {
        included: included,
        enabled: true//enabled
    }
}

// Remove a group from the list of
// excludes in cat (modifies cat by
// reference). Think of this function
// as "unexclude_group".
function include_group(cat: Cat, group: string) {
    if (cat.exclude !== undefined) {
	// Remove the group from the exclude array
	const index = cat.exclude.indexOf(group);
        if (index > -1) {
            cat.exclude.splice(index, 1);
        }
	// Delete the exclude key if empty
	if (cat.exclude.length == 0) {
	    delete cat.exclude
	}	
    }
}

// Add a group to the list of excludes
// in cat, creating the exclude key
// if nececessary (cat is modified
// by reference)
function exclude_group(cat: Cat, group: string) {
    if (cat.exclude !== undefined) {
        cat.exclude.push(group)
    } else {
        cat.exclude = [group]
    }
}

// Remove all the exclude tags in all
// sublevels of cat and return the result
function remove_all_excludes(cat: Cat, group: string) {

    // Remove the group from the exclude
    // list at this level
    include_group(cat, group)
 
    if (cat.child !== undefined) {
        // Loop over all the subcategories
        // remove the exclude
	// BUG: what even is the line blow?
	// Need to pass in a function, remove_all
	// _excludes is not getting any arguments
        cat.child = cat.child.map((subcat) => (
	    remove_all_excludes(subcat, group)
	))
    }

    // Return the modified category
    return cat
}

// Set the top-level excludes for the
// subcategories in the current category,
// and return the modified object
function set_first_excludes(cat: Cat, group: string) {
    if (cat.child !== undefined) {
        cat.child = cat.child.map((subcat) => {
            // Add the group to the excludes key,
            // or create a new excludes list if
            // necessary
            exclude_group(cat, group)
            return (subcat)
        })
    }
    return cat
}

// Props for a category or code element
interface CategoryData {
    index: number; // Where is this category in the parent child list
    cat: Cat; // The data for this category
    parent_exclude: boolean; // Whether the parent is excluded
    toggle_cat: (indices: number[],
		 included: boolean) => void; // Callback to enable/disable
    group: string; // The currently selected group
}

function Category({ index, cat, parent_exclude,
		    toggle_cat, group }: CategoryData) {

    const { included, enabled } = visible_status(cat, group, parent_exclude)

    // Whether the children of this element are hidden
    let [hidden, setHidden] = useState(true);

    // Take action when the user clicks the checkbox. Note that
    // this function cannot be called for a grayed out box,
    // because it cannot change. This means you can assume the
    // current level is enabled, meaning that none of the parents
    // are excluded.
    function handleChange() {
        toggle_cat([index], included)
    }

    // Pass requests by subcomponents up to the top level.
    // The indices argument represents the tail of the indices
    // list, and included is passed from the subcomponent
    // upwards
    function toggle_cat_sub(indices: number[], included: boolean) {
        let new_indices = [index].concat(indices)
        toggle_cat(new_indices, included)
    }

    if (cat.child !== undefined) {
	// cat is a category
	return <div>
	    <Checkbox checked={included}
		enabled={enabled}
		onChange={handleChange}></Checkbox>
	    <span className={styles.cat_row}
		  onClick = {() => setHidden(!hidden) }>
		<span className={styles.cat_name}>
		    {cat.category}
		</span>
		<span className={styles.cat_desc}>
		    {cat.docs}
		</span>
	    </span>
	    <ol className={styles.cat_list}> {
		cat.child.map((node,index) => {
		    if (!hidden) {
			return <li key={node.index}>
			    <Category index={index}
				      cat={node}
				      parent_exclude={!included}
				      toggle_cat={toggle_cat_sub}
				      group={group} />
			</li>
		    }
		})
	    } </ol>	    
	</div>
    } else {
	// cat is a code (leaf node)
	return <div>
	    <Checkbox checked={included}
		      enabled={enabled}
		      onChange={handleChange}></Checkbox>
	    <span onClick = {() => setHidden(!hidden) }>
		<span className={styles.cat_name}>
		    {cat.code}
		</span>
		<span className={styles.cat_desc}>
		    {cat.docs}
		</span>
	    </span>
	</div>	
    }

}

interface CodeDef {
    groups: string[]
    child: Cat[]
}

// Get the category at nesting level
// defined by indices from code_def
// structure. A reference to a
// category inside code_def is
// returned, so this function
// provides a way to modify code_def
// at arbitrary depth. Note that you
// can also use this function to get
// a subcategory relative to any
// (non-root) category, provided you
// also pass the relative indices
function get_cat(code_def: Cat, indices: number[]) {
    let cat = code_def;
    indices.forEach((n) => {
	if (cat.child !== undefined) {
	    cat = cat.child[n]
	} else {
	    throw new Error("Expected to find cat");
	}
    })
    return cat;
}

export default function Home() {

    let [code_def, setCodeDef] = useState<Cat>({docs: "None",
						index: "None"});

    // Function to save the codes yaml file
    function save_file() {
        invoke('save_yaml', { codeDef: code_def })
    }

    // Function to get the list of groups
    function get_groups() {
	if (code_def.groups !== undefined) {
            return code_def.groups
	} else {
	    throw new Error("Cannot get groups before loading a file");
	}
    }

    // State for the current group
    // BUG: not starting with the correct
    // group, because it needs to be set
    // when the file is loaded.
    const [group, setGroup] = useState("");

    // Function to load the codes yaml file
    function load_file() {
        invoke('get_yaml')
	    .then((result) => {

		let res: Cat = JSON.parse(result as string);
		console.log(res)
		// Note: all .then are executed
		// asynchronously, so put
		// sequential steps in here
		if (res.groups !== undefined) {
		    if (res.groups.length > 0) {
			setGroup(res.groups[0])
		    } else {
			alert("No groups found. Add some groups and reload the file.")
			return
		    }
		} else {
		    alert("Did not find groups key. Add a groups key containing an array of groups.")
		    return
		}
		// If you get here, then the state is valid
		setCodeDef(res)

	    })
    }

    const handleGroupChange = (event: ChangeEvent<HTMLSelectElement>) => {
        //console.log(event.target.value)
        setGroup(event.target.value);
    };

    function toggle_cat(indices: number[], included: boolean) {

        // Copy the codes definition structure
        // to modify it. This may be a performance
        // problem, but it can be optimised later.
        let code_def_copy = structuredClone(code_def);

        // Extract the cat referred to by indices
        // (note that cat is modified by reference,
        // so changing the resulting cat will still
        // change code_def_copy)
        let cat = get_cat(code_def_copy, indices)

        // Check the current state of the checkbox
        if (included) {
            // When the current component is included,
            // the user is wanting to disable this element,
            // and all of its subcomponents. This involves
            // writing an exclude tag into the current
            // level, and clearing any exclude flags
            // in subcomponent levels (for efficiency
            // of representation)

            // Deep copy the state to use setCat without
            // problems
            let cat_copy = Object.assign({}, cat)

            // Clear all the nested exclude tags
            // and then re-enable the current level
            // exclude flag
            cat = remove_all_excludes(cat, group)
            exclude_group(cat, group)

	    console.log("Included, now ", cat)

        } else {
            // When the current component is excluded,
            // the user is wanting to enable this level
            // and all sublevels, and implicitly enable
            // higher levels on the path from this node
            // to the root of the tree.

            // If the current level is excluded, then
            // either it itself has an exclude key,
            // or there is an exclude key above it.
            // Either way, there are guaranteed to be
            // not excludes below it. In addition:
            //
            // 1) If there is an exclude here, then it
            //    implies that no levels above this
            //    are excluded (otherwise this level
            //    would not be excluded)
            // 2) If there is no exclude here, then
            //    there is exactly one exclude above it
            //    (two or more would contradict the
            //    reasoning above).
            //
            // NOTE: Remember that this reasoning becomes
            // invalid if deselecting does not clear
            // all the subcategory exclude keys.

            // Find the first category above which
            // has an exclude key (which may be this
            // category).
            let indices_above = indices.slice();
            let cat_above = cat;
            while (true) {

		// Find the first category above
		// (or equal to) cat where there
		// is an exclude for the current
		// group
		if (cat_above.exclude !== undefined) {
		    if (cat_above.exclude.includes(group)) {
			break
		    }
		}
		
		// Move to the category above
		indices_above.pop()
                cat_above = get_cat(code_def_copy,
				    indices_above)
            }

            // At this point, cat is the category
            // of interest and cat_above is the
            // first higher category that contains
            // an exclude (which may be equal to cat).
            // Remove this exclude.
	    include_group(get_cat(code_def_copy, indices_above),
			  group)
	    
            // Now walk back down the tree from
            // cat above adding
            // excludes for categories not on the
            // path to cat, so as not to incorrectly
            // include any other categories. First,
            // get the indices of cat relative to
            // cat_above
            let rel_indices = indices.slice(indices_above.length);
	    console.log("rel", rel_indices)
	    
            // Loop over all the subcategories between
            // cat_above and cat
            cat = cat_above
            rel_indices.forEach((n) => {

                // Add an exclude key to all the
                // subcategories which are not on the path
		if (cat.child !== undefined) {
                    cat.child = cat.child.map((subcat, index) => {
			if (index != n) {
                            exclude_group(subcat, group)
			}
			return (subcat)
                    })
		} else {
		    throw new Error("Expected to find child key")
		}

                // Move down a level
                cat = cat.child[n]
            })

	    console.log("Included, now ", cat)
        }

        // Now save the new code_defs state
        setCodeDef(code_def_copy)
    }

    // TODO: fix this -- currently using the presence of
    // child key to tell whether the file is loaded
    if (code_def.child == undefined) {
        return <div>
            <h1>ICD-10 Editor</h1>
	    <p className={styles.info}>Load a codes file to edit groups of ICD-10 codes</p>
	    <div>
		<span className={styles.button}
		      onClick={load_file}>Load file</span>
		<Link className={styles.button} href="/">Back</Link>
	    </div>
	</div>
    } else {
        return <div>
            <h1>ICD-10 Editor</h1>
	    <p className={styles.info}>Use the groups selector to pick a group, and then use the checkboxes to include or exclude categories or codes from the group. When you are finished, save the resulting groups to a file.</p>
	    <div>
		<span className={styles.button}
		    onClick={save_file}>Save as</span>
		<Link className={styles.button} href="/">Back</Link>
	    </div>
	    <div className={styles.groups}>
		Groups: <select onChange={handleGroupChange}> {
		    get_groups().map((grp) => (
			<option key={grp}>{grp}</option>
		    ))
		} </select>
	    </div>
	    <Category index={0}
		      cat={code_def.child[0]}
		      parent_exclude={false}
		      toggle_cat={toggle_cat}
		      group={group} />
	</div>
    }
}
