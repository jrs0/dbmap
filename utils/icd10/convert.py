#!/usr/bin/env python
from bs4 import BeautifulSoup
import yaml

def diagnosis_xml_to_dict(diagnosis):
    return {
        "name": diagnosis.find("name").text,
        "docs": diagnosis.find("desc").text,
    }

def section_xml_to_dict(section):
    
    diagnosis_list = []
    for diagnosis in chapter.find_all("diag"):
        diagnosis_list.append(diagnosis_xml_to_dict(diagnosis))
    
    section_dict = {
        "name": section.get("id"),
        "docs": section.find("desc").text,
        "categories": diagnosis_list,
    }

        
def chapter_xml_to_dict(chapter):

    section_list = []
    for section in chapter.find_all("section"):
        section_list.append(section_xml_to_dict(section))
    
    chapter_dict = {
        "name": chapter.find("name").text,
        "docs": chapter.find("desc").text,
        "categories": section_list,
    }
    return chapter_dict

with open('icd10cm_april_2023.xml', 'r') as f:
    data = f.read()

    codes_data = BeautifulSoup(data, "xml")

    for chapter in codes_data.find_all("chapter"):
        print(yaml.dump(chapter_xml_to_dict(chapter)))

    # # Finding all instances of tag
    # # `unique`
    # b_unique = Bs_data.find_all('unique')
    
    # print(b_unique)
    
    # # Using find() to extract attributes
    # # of the first instance of the tag
    # b_name = Bs_data.find('child', {'name':'Frank'})
    
    # print(b_name)
    
    # # Extracting the data stored in a
    # # specific attribute of the
    # # `child` tag
    # value = b_name.get('test')
    
    # print(value)
