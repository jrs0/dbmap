import { useState, useRef, useEffect, useMemo, ChangeEvent } from 'react';
import { invoke } from "@tauri-apps/api/tauri"
import Link from 'next/link'

import Collapsible from 'react-collapsible';

import styles from '../styles/Category.module.css'
import record_styles from '../styles/ClinicalCodeComp.module.css'

import { parse_search_terms } from "../services/search_term.tsx"

// Information for the tick box that selects categories or codes
interface CategorySelector {
    checked: boolean;
    onChange: () => void;
}

function Checkbox({ checked, onChange }: CategorySelector) {
    const checkboxRef = useRef<HTMLInputElement>(null);
    return <input
                ref={checkboxRef}
                type="checkbox"
                checked={checked}
                onChange={onChange} />
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

function is_leaf_category(category) {
    return category.categories === undefined
}

// Establish whether the component should be included
// (i.e. ticked) and whether it should be enabled
// (grayed out or not)
function is_ticked(category: Category, group: string, parent_exclude: boolean) {
    // Component is included by default, unless there
    // is an exclude tag at the current level, or
    // the parent is excluded
    let exclude_tag = false
    if (category.exclude !== undefined) {
	exclude_tag = category.exclude.includes(group);
    }
    let included = !exclude_tag && !parent_exclude

    return included
}


function group_not_in_category(category, group) {
    return (category_above.exclude !== undefined) &&
	   (category_above.exclude.includes(group))
}

// Remove a group from the list of
// excludes in cat (modifies cat by
// reference). Think of this function
// as "unexclude_group".
function include_group(category: Category, group: string) {
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

// Remove all the exclude tags in this category and
// all its subcategories in place.
// sublevels of category and return the result
function remove_all_excludes(category: Category, group: string) {
    include_group(category, group)
    if (!is_leaf_category(category)) {
        category.categories.map((sub_category) => (
	    remove_all_excludes(sub_category, group)
	))
    }
}

// Props for a category or code element
interface CategoryData {
    index: number, // Where is this category in the parent child list
    category: Category, // The data for this category
    parent_exclude: boolean, // Whether the parent is excluded
    toggle_cat: (indices: number[],
		 included: boolean) => void, // Callback to enable/disable
    group: string, // The currently selected group
    hidden: boolean, // Whether the category is expanded
}

function CategoryHeader({ category }) {
    return <span className={styles.category_row}>
	<span className={styles.category_name}>
	    {category.name}
	</span>
	<span className={styles.category_desc}>
	    {category.docs}
	</span>
    </span>
}

function docs_contains_match(category, lower_case_search_term) {
    return category.docs.toLowerCase().includes(lower_case_search_term)
}

function any_match_in_category(category, lower_case_search_term) {
    if (is_leaf_category(category)) {
	return docs_contains_match(category, lower_case_search_term)
    } else {
	return category
	    .categories
	    .map(sub_category => any_match_in_category(sub_category,
						       lower_case_search_term))
	    .some(Boolean)
    }
}

function CategoryElem({ index, category, parent_exclude,
			toggle_cat, group, outer_hidden, search_term}: CategoryData) {

    const included = is_ticked(category, group, parent_exclude)

    let [inner_hidden, setInnerHidden] = useState(false)
    
    function handleChange() {
        toggle_cat([index], included)
    }

    function hidden_category_indices(categories) {
	let category_indices = categories.map(node => (!node.docs.toLowerCase().includes(search_term)))
	return category_indices
    }
    
    function toggle_cat_sub(indices: number[], included: boolean) {
        let new_indices = [index].concat(indices)
        toggle_cat(new_indices, included)
    }

    const hidden = !any_match_in_category(category, search_term)
    
    if (is_leaf_category(category)) {
	// Leaf
	return <div className={hidden ? styles.hidden : {}}>
	    <Checkbox checked={included}
		      onChange={handleChange} />
	    <span>
		<span className={styles.category_name}>
		    {category.name}
		</span>
		<span className={styles.category_desc}>
		    {category.docs}
		</span>
	    </span>
	</div>	
    } else {
	
	const hidden_list = hidden_category_indices(category.categories)

	// Non-leaf
	return <div className={hidden ? styles.hidden : {}}>
	    <span className={styles.checkbox}>
		<Checkbox checked={included}
			  onChange={handleChange} />
	    </span>
	    <span className={styles.category_header} onClick={() => setInnerHidden(!inner_hidden)}>
		<CategoryHeader category={category} />
	    </span>
	    <ol className={styles.category_list}> {
		category.categories.map((node,index) => {
		    return <li key={node.index}>
			<CategoryElem index={index}
				      category={node}
				      parent_exclude={!included}
				      toggle_cat={toggle_cat_sub}
				      group={group}
				      outer_hidden={hidden_list[index]}
				      search_term={search_term} />
		    </li>
		})
	    } </ol>
	</div>
    }
}

interface TopLevelCategory {
    categories: Category[]
    groups: string[]
}


function get_category_ref(top_level_category: TopLevelCategory, indices: number[]) {

    // Get the first category as a special case (convert from top level
    // category to plain category)
    let category = top_level_category.categories[indices[0]];
    indices.slice(1).forEach((n) => {
	if (!is_leaf_category(category)) {
	    category = category.categories[n]
	} else {
	    throw new Error("Expected to find a category in get_category_ref() (wrong indices?)");
	}
    })
    return category;
}

export default function Home() {

    let [top_level_category, setTopLevelCategory] = useState<TopLevelCategory>({categories: [], groups: []});

    const [searchTerm, setSearchTerm] = useState('');

    
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

    let open = false;
    if(searchTerm.length > 0) {
	open = true;
    }
    console.log(searchTerm, searchTerm.length, open)
    
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

    const handleSearchTermChange = (event: React.ChangeEvent<any>) => {
	setSearchTerm(event.target.value);
	console.log(searchTerm)
    };

    function category_excludes_group(category, group) {
	return (category.exclude !== undefined) &&
	       (category.exclude.includes(group))
    }
	    
    function first_higher_category_excluding_group(category_indices, group) {
	let indices_copy = category_indices.slice()
	while (true) {
	    let category = get_category_ref(top_level_category, indices_copy)
	    if (category_excludes_group(category, group)) {
		break;
	    }
	    indices_copy.pop()
        }
	return indices_copy
    }

    // Include the subcategory referred to by indices relative to
    // another category, by including all categories between the two
    // and ensuring that other sibling categories are excluded.
    function include_subcategory_at_depth(category, indices, group) {
	console.log("h", category)
        indices.forEach((n) => {
	    if (!is_leaf_category(category)) {
                category.categories = category.categories.map((sub_category, index) => {
		    if (index != n) {
                        exclude_group(sub_category, group)
		    }
                })
	    } else {
		throw new Error("Expected to find child key")
	    }
            category = category.categories[n]
        })	
    }
    
    function toggle_cat(indices: number[], included: boolean) {
        let top_level_category_copy = structuredClone(top_level_category);
        let category_to_modify = get_category_ref(top_level_category_copy, indices)
        if (included) {
	    remove_all_excludes(category_to_modify, group)
            exclude_group(category_to_modify, group)
        } else {
            let indices_above = first_higher_category_excluding_group(indices, group)
	    console.log("first higher excluding group", indices_above)
	    let category_above = get_category_ref(top_level_category_copy, indices_above)
	    console.log("a", category_above)
	    include_group(category_above, group)
	    console.log("b", category_above)
	    let relative_indices = indices.slice(indices_above.length)
	    console.log(relative_indices)
	    include_subcategory_at_depth(category_above, relative_indices, group)
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
		<label htmlFor="search">Search: </label>
		<input autocomplete="off" id="search" type="text" onChange={handleSearchTermChange}/>
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
			<CategoryElem index={index}
				      category={node}
				      parent_exclude={false}
				      toggle_cat={toggle_cat}
				      group={group}
				      search_term={searchTerm.toLowerCase()}
			/>
		    </li>
		})
	    } </ol>
	</div>
	
    }
}
