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

// The main category for a code
// range or a specific code
interface Category {
    name: string
    docs: string;
    index: string;
    categories?: Category[];
    exclude?: string[];
}


// Establish whether the component should be included
// (i.e. ticked) and whether it should be enabled
// (grayed out or not)
function visible_status(category: Category, group: string, parent_exclude: boolean) {
    // Component is included by default, unless there
    // is an exclude tag at the current level, or
    // the parent is excluded
    let exclude_tag = false
    if (category.exclude !== undefined) {
	exclude_tag = category.exclude.includes(group);
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
function include_group(category: Categoryegory, group: string) {
    if (category.exclude !== undefined) {
	// Remove the group from the exclude array
	const index = category.exclude.indexOf(group);
        if (index > -1) {
            category.exclude.splice(index, 1);
        }
	// Delete the exclude key if empty
	if (category.exclude.length == 0) {
	    delete category.exclude
	}	
    }
}

// Add a group to the list of excludes
// in cat, creating the exclude key
// if nececessary (cat is modified
// by reference)
function exclude_group(category: Category, group: string) {
    if (category.exclude !== undefined) {
        category.exclude.push(group)
    } else {
        category.exclude = [group]
    }
}

// Remove all the exclude tags in all
// sublevels of category and return the result
function remove_all_excludes(category: Category, group: string) {

    // Remove the group from the exclude
    // list at this level
    include_group(category, group)
 
    if (category.categories !== undefined) {
        // Loop over all the subcategoryegories
        // remove the exclude
	// BUG: what even is the line blow?
	// Need to pass in a function, remove_all
	// _excludes is not getting any arguments
        category.categories = category.categories.map((sub_category) => (
	    remove_all_excludes(sub_category, group)
	))
    }

    // Return the modified categoryegory
    return category
}

// Set the top-level excludes for the
// subcategoryegories in the current categoryegory,
// and return the modified object
function set_first_excludes(category: Category, group: string) {
    if (category.categories !== undefined) {
        category.categories = category.categories.map((sub_category) => {
            // Add the group to the excludes key,
            // or create a new excludes list if
            // necessary
            exclude_group(category, group)
            return (sub_category)
        })
    }
    return category
}

// Props for a category or code element
interface CategoryData {
    index: number; // Where is this category in the parent child list
    category: Category; // The data for this category
    parent_exclude: boolean; // Whether the parent is excluded
    toggle_cat: (indices: number[],
		 included: boolean) => void; // Callback to enable/disable
    group: string; // The currently selected group
}

function CategoryElem({ index, category, parent_exclude,
			toggle_cat, group }: CategoryData) {

    const {
	included,
	enabled
    } = visible_status(category, group, parent_exclude)

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

    // This is a candidate for simplifying now
    if (category.categories !== undefined) {
	// Non-leaf
	return <div>
	    <Checkbox checked={included}
		enabled={enabled}
		onChange={handleChange}></Checkbox>
	    <span className={styles.category_row}
		  onClick = {() => setHidden(!hidden) }>
		<span className={styles.category_name}>
		    {category.name}
		</span>
		<span className={styles.category_desc}>
		    {category.docs}
		</span>
	    </span>
	    <ol className={styles.category_list}> {
		category.categories.map((node,index) => {
		    if (!hidden) {
			return <li key={node.index}>
			    <CategoryElem index={index}
				      category={node}
				      parent_exclude={!included}
				      toggle_cat={toggle_cat_sub}
				      group={group} />
			</li>
		    }
		})
	    } </ol>	    
	</div>
    } else {
	// Leaf
	return <div>
	    <Checkbox checked={included}
		      enabled={enabled}
		      onChange={handleChange}></Checkbox>
	    <span onClick = {() => setHidden(!hidden) }>
		<span className={styles.category_name}>
		    {category.name}
		</span>
		<span className={styles.category_desc}>
		    {category.docs}
		</span>
	    </span>
	</div>	
    }

}

// The top level category has a groups
// list that defines which groups are
// present in the file. The only other
// field is the categories list, which
// defines the top level of the category
// tree
interface TopLevelCategory {
    categories: Category[]
    groups: string[]
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
function get_cat(top_level_category: TopLevelCategory, indices: number[]) {
    let cat = top_level_category;
    indices.forEach((n) => {
	if (cat.categories !== undefined) {
	    cat = cat.categories[n]
	} else {
	    throw new Error("Expected to find cat");
	}
    })
    return cat;
}

export default function Home() {

    let [top_level_category, setTopLevelCategory] = useState<ToplevelCategory>({categories: [], groups: []});

    // Function to save the codes yaml file
    function save_file() {
        invoke('save_yaml', {
	    topLevelCategory: top_level_category
	})
    }

    // Function to get the list of groups
    function get_groups() {
	if (top_level_category.groups.length != 0) {
            return top_level_category.groups
	} else {
	    throw new Error("There are no groups in the current top level category");
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

		// From rust
		let res: TopLevelCategory = JSON.parse(result as string);
		console.log(res)
		
		// Currently just a quick hack to avoid crashing if
		// the user closes the dialog box
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
		setTopLevelCategory(res)
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
        let top_level_category_copy = structuredClone(top_level_category);

        // Extract the cat referred to by indices
        // (note that cat is modified by reference,
        // so changing the resulting cat will still
        // change top_level_category_copy)
        let category = get_cat(top_level_category_copy, indices)

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
            let category_copy = Object.assign({}, category)

            // Clear all the nested exclude tags
            // and then re-enable the current level
            // exclude flag
            category = remove_all_excludes(category, group)
            exclude_group(category, group)

	    console.log("Included, now ", category)

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
            let category_above = category;
            while (true) {

		// Find the first category above
		// (or equal to) cat where there
		// is an exclude for the current
		// group
		if (category_above.exclude !== undefined) {
		    if (category_above.exclude.includes(group)) {
			break
		    }
		}
		
		// Move to the category above
		indices_above.pop()
                category_above = get_cat(top_level_category_copy,
					 indices_above)
            }

            // At this point, cat is the category
            // of interest and cat_above is the
            // first higher category that contains
            // an exclude (which may be equal to cat).
            // Remove this exclude.
	    include_group(get_cat(top_level_category_copy, indices_above),
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
            category = category_above
            rel_indices.forEach((n) => {

                // Add an exclude key to all the
                // subcategories which are not on the path
		if (category.categories !== undefined) {
                    category.categories = category.categories.map((sub_category, index) => {
			if (index != n) {
                            exclude_group(sub_category, group)
			}
			return (sub_category)
                    })
		} else {
		    throw new Error("Expected to find child key")
		}

                // Move down a level
                category = category.categories[n]
            })

	    console.log("Included, now ", category)
        }

        // Now save the new top_level_categorys state
        setTopLevelCategory(top_level_category_copy)
    }

    // TODO: Currently using the length of the categories array
    // as a proxy for whether the file is loaded. Fix.
    if (top_level_category.categories.length == 0) {
        return <div>
            <h1>Code Group Editor</h1>
	    <p className={styles.info}>Load a codes file to define groups of codes</p>
	    <div>
		<span className={styles.button}
		      onClick={load_file}>Load file</span>
		<Link className={styles.button} href="/">Back</Link>
	    </div>
	</div>
    } else {
        return <div>
            <h1>Code Group Editor</h1>
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

	    <ol className={styles.category_list}> {
		top_level_category.categories.map((node,index) => {
			return <li key={node.index}>
			    <CategoryElem index={0}
					  category={node}
					  parent_exclude={false}
					  toggle_cat={toggle_cat}
					  group={group} />
			</li>
		})
	    } </ol>	    
	    {/* <CategoryElem index={0}
		cat={top_level_category.child[0]}
		parent_exclude={false}
		toggle_cat={toggle_cat}
		group={group} /> */}
	</div>
	
    }
}
