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

function hide_category(category: Category, hidden: boolean) {
    // hidden key is really just a placemarker. Only ever
    // true or missing (this feels wrong)
    if (hidden) {
	category.hidden = true
    } else {
	if (category.hidden !== undefined) {
            delete category.hidden
	}	
    }
}

function is_hidden(category: Category) {
    /// Assumes presence of hidden key means hidden
    return category.hidden !== undefined
}

function is_visible(category) {
    return !is_hidden(category)
}

function include_visible_category_tree(category: Category, group: string) {
    if (!is_hidden(category)) {
	include_group(category, group)
	if (!is_leaf_category(category)) {
            category.categories.map((sub_category) => (
		include_visible_category_tree(sub_category, group)
	    ))
	}
    }
}

function append_group_to_exclude_list(category: Category, group: string) {
    if (category.exclude !== undefined) {
        category.exclude.push(group)
    } else {
        category.exclude = [group]
    }
}

function remove_group_from_exclude_list(category: Category, group: string) {
    if (category.exclude !== undefined) {
	const index = category.exclude.indexOf(group);
        if (index > -1) {
            category.exclude.splice(index, 1);
        }
	if (category.exclude.length == 0) {
	    delete category.exclude
	}	
    }
}


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

function name_contains_match(category, lower_case_search_term) {
    return category.name.toLowerCase().includes(lower_case_search_term)
}

function any_match_in_category(category, lower_case_search_term) {
    if (is_leaf_category(category)) {
	return (docs_contains_match(category, lower_case_search_term))
	    || (name_contains_match(category, lower_case_search_term))
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
    hide_category(category, hidden)
    
    if (is_leaf_category(category)) {
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
	return <div className={is_hidden(category) ? styles.hidden : {}}>
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

function exclude_all_visible_subcategories_except_n(category, n, group) {
    category.categories.map((sub_category, index) => {
	if (index != n) {
	    if (!is_hidden(sub_category)) {
		exclude_group(sub_category, group)
	    }
	}
    })
}

function category_excludes_group(category, group) {
    return (category.exclude !== undefined) &&
	   (category.exclude.includes(group))
}

function include_subcategory_at_depth(category, indices, group) {
    indices.forEach((n) => {
	if (!is_leaf_category(category)) {
	    exclude_all_visible_subcategories_except_n(category, n, group)
	} else {
	    throw new Error("Expected to find child key")
	}
        category = category.categories[n]
    })
}

function first_super_category_excluding_group(top_level_category, category_indices, group) {
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

function sub_categories(category) {
    if (!is_leaf_category(category)) {
	return category.categories
    } else {
	return []
    }
}

function exclude_invisible_sub_categories(category, group) {
    sub_categories(category).map(sub_category => {
	if (is_hidden(sub_category)) {
	    exclude_group(sub_category, group)
	}
    })
}

function exclude_visible_sub_categories(category, group) {
    if (is_leaf_category(category)) {
	if (is_visible(category)) {
	    append_group_to_exclude_list(category, group)
	}
    } else {
	sub_categories(category)
	    .filter(is_visible)
	    .map(sub_category => {
		exclude_visible_sub_categories(sub_category, group)
	    })
    }
}

function include_visible_sub_categories(top_level_category, indices, group) {
    if (is_leaf_category(category)) {
	if (is_visible(category)) {
	    // needs the parent to be included
	    remove_group_from_exclude_list(category, group)
	}
    } else {
	sub_categories(category)
	    .filter(is_visible)
	    .map(sub_category => {
		
	    })
	
    }
    
    /* let indices_above = first_super_category_excluding_group(top_level_category, indices, group)
     * let super_category = get_category_ref(top_level_category, indices_above)
     * include_group(super_category, group)
     * let relative_indices = indices.slice(indices_above.length)
     * include_subcategory_at_depth(super_category, relative_indices, group)
     * let category = get_category_ref(top_level_category, indices)
     * exclude_invisible_subcategories(category, group) */
}

export default function Home() {

    let [top_level_category, setTopLevelCategory] = useState<TopLevelCategory>({categories: [], groups: []});
    const [searchTerm, setSearchTerm] = useState('');
    
    function save_file() {
        invoke('save_yaml', {
	    topLevelCategory: top_level_category
	})
    }

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
    
    function toggle_cat(indices: number[], included: boolean) {
        let top_level_category_copy = structuredClone(top_level_category);
        let category_to_modify = get_category_ref(top_level_category_copy, indices)
        if (included) {
	    
        } else {

        }
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
